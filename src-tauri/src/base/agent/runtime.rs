use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::ipc::Channel;
use tokio::sync::mpsc;

use crate::base::providers::{ChatMessage, Provider, StreamChunk};
use crate::base::tools::{DynTool, ToolContext};

use super::context::ConversationContext;
use super::stream::AgentStreamEvent;

/// Stats collected during a single `run()` call.
#[derive(Debug, Default)]
pub struct RunStats {
  pub prompt_tokens: u64,
  pub completion_tokens: u64,
  pub tool_calls: u64,
  pub tool_errors: u64,
}

/// The main agent loop. Owns provider, tools, context, and streams events to frontend.
pub struct AgentRuntime {
  provider: Arc<dyn Provider>,
  tools: Vec<DynTool>,
  tool_context: ToolContext,
  system_prompt: String,
  max_tool_rounds: u32,
  token_budget: usize,
  compact_threshold: f64,
}

impl AgentRuntime {
  pub fn new(
    provider: Arc<dyn Provider>,
    tools: Vec<DynTool>,
    tool_context: ToolContext,
    system_prompt: String,
    max_tool_rounds: u32,
    token_budget: usize,
    compact_threshold: f64,
  ) -> Self {
    Self {
      provider,
      tools,
      tool_context,
      system_prompt,
      max_tool_rounds,
      token_budget,
      compact_threshold,
    }
  }

  /// Get tool schemas for passing to the LLM.
  fn tool_schemas(&self) -> Vec<Value> {
    self.tools.iter().map(|t| t.schema()).collect()
  }

  /// Compact the context if it is approaching the token budget.
  /// Keeps the last 6 messages and replaces the rest with an LLM-generated summary.
  async fn try_compact(&self, ctx: &mut ConversationContext) {
    let current = if ctx.last_prompt_tokens > 0 {
      ctx.last_prompt_tokens as usize
    } else {
      ctx.token_count_approx() as usize
    };

    let threshold = (self.token_budget as f64 * self.compact_threshold) as usize;
    if current < threshold || ctx.messages.len() <= 6 {
      return;
    }

    // Keep the last 6 messages; summarize everything before them.
    let keep_count = 6;
    let old_len = ctx.messages.len() - keep_count;
    let old_messages = ctx.messages[..old_len].to_vec();
    let recent_messages = ctx.messages[old_len..].to_vec();

    let summary_prompt = format!(
      "Summarize the following conversation history concisely. \
       Focus on key facts, decisions, tool results, and context that would be needed to continue. \
       Reply with a single plain-text paragraph.\n\n---\n{}",
      old_messages
        .iter()
        .filter_map(|m| {
          let role = &m.role;
          let content = m.content.as_ref()?.as_str()?;
          Some(format!("{}: {}", role, content))
        })
        .collect::<Vec<_>>()
        .join("\n")
    );

    let summary_msgs = vec![ChatMessage::user(&summary_prompt)];
    match self.provider.chat(&summary_msgs, &[]).await {
      Ok(resp) => {
        let summary = resp.content.unwrap_or_else(|| "(no summary)".to_string());
        let summary_msg = ChatMessage::user(format!("[Context Summary]: {}", summary));
        ctx.messages = std::iter::once(summary_msg).chain(recent_messages).collect();
        ctx.last_prompt_tokens = 0; // reset after compaction
      },
      Err(_) => {
        // Compaction failed; fall back to keeping recent messages only
        ctx.messages = recent_messages;
        ctx.last_prompt_tokens = 0;
      },
    }
  }

  /// Run the agent for a single user turn, streaming events via Tauri Channel.
  /// Returns stats for the completed run.
  pub async fn run(
    &self,
    ctx: &mut ConversationContext,
    user_message: &str,
    channel: Channel<AgentStreamEvent>,
    stop_flag: Arc<AtomicBool>,
  ) -> RunStats {
    let mut stats = RunStats::default();

    // Compact before adding the new user message if context is large
    self.try_compact(ctx).await;

    ctx.add(ChatMessage::user(user_message));

    for round in 0..self.max_tool_rounds {
      if stop_flag.load(Ordering::Relaxed) {
        let _ = channel.send(AgentStreamEvent::Done {
          finish_reason: "stopped".to_string(),
        });
        return stats;
      }

      let messages = ctx.messages_with_system(&self.system_prompt);
      let schemas = self.tool_schemas();

      // Spawn LLM stream in a task
      let (tx, mut rx) = mpsc::channel::<StreamChunk>(64);
      let provider = Arc::clone(&self.provider);
      tokio::spawn(async move {
        if let Err(e) = provider.chat_stream(&messages, &schemas, tx.clone()).await {
          let _ = tx.send(StreamChunk::Error { message: e.to_string() }).await;
        }
      });

      // Collect stream
      let mut full_text = String::new();
      let mut finish_reason = String::from("stop");
      let mut tool_calls = Vec::new();
      let mut had_error = false;

      while let Some(chunk) = rx.recv().await {
        if stop_flag.load(Ordering::Relaxed) {
          let _ = channel.send(AgentStreamEvent::Done {
            finish_reason: "stopped".to_string(),
          });
          return stats;
        }

        match chunk {
          StreamChunk::TextDelta { delta } => {
            full_text.push_str(&delta);
            let _ = channel.send(AgentStreamEvent::TextDelta { delta });
          },
          StreamChunk::Done {
            finish_reason: fr,
            tool_calls: tcs,
            usage,
          } => {
            finish_reason = fr;
            tool_calls = tcs;
            if let Some(u) = usage {
              ctx.last_prompt_tokens = u.prompt_tokens;
              stats.prompt_tokens += u.prompt_tokens as u64;
              stats.completion_tokens += u.completion_tokens as u64;
              let _ = channel.send(AgentStreamEvent::TokenUsage {
                prompt_tokens: u.prompt_tokens,
                completion_tokens: u.completion_tokens,
                total_tokens: u.total_tokens,
              });
            }
          },
          StreamChunk::Error { message } => {
            let _ = channel.send(AgentStreamEvent::Error { message });
            had_error = true;
            break;
          },
        }
      }

      if had_error {
        return stats;
      }

      // Add assistant reply to context
      if tool_calls.is_empty() {
        ctx.add(ChatMessage::assistant_text(&full_text));
        let _ = channel.send(AgentStreamEvent::Done { finish_reason });
        return stats;
      }

      // Has tool calls — add assistant message with tool calls
      ctx.add(ChatMessage::assistant_with_tool_calls(
        if full_text.is_empty() { None } else { Some(full_text) },
        tool_calls.clone(),
      ));

      // Execute each tool call
      for tc in &tool_calls {
        let tool_id = tc.id.clone();
        let tool_name = tc.function.name.clone();
        let args_str = &tc.function.arguments;

        let _ = channel.send(AgentStreamEvent::ToolCallStart {
          id: tool_id.clone(),
          name: tool_name.clone(),
          args: args_str.clone(),
        });

        let args: Value = serde_json::from_str(args_str).unwrap_or(Value::Object(Default::default()));

        let tool_start = Instant::now();
        let (result, success) = if let Some(tool) = self.tools.iter().find(|t| t.name() == tool_name) {
          match tool.call(&self.tool_context, args).await {
            Ok(output) => (output, true),
            Err(e) => (format!("Tool error: {e}"), false),
          }
        } else {
          (format!("Tool not found: {tool_name}"), false)
        };
        let duration_ms = tool_start.elapsed().as_millis() as u64;

        stats.tool_calls += 1;
        if !success {
          stats.tool_errors += 1;
        }

        let _ = channel.send(AgentStreamEvent::ToolCallResult {
          id: tool_id.clone(),
          name: tool_name.clone(),
          result: result.clone(),
          duration_ms,
          success,
        });

        ctx.add(ChatMessage::tool_result(&tool_id, &result));
      }

      // If we've used all rounds, stop
      if round + 1 >= self.max_tool_rounds {
        let _ = channel.send(AgentStreamEvent::Error {
          message: format!("Reached max tool call rounds ({})", self.max_tool_rounds),
        });
        return stats;
      }
    }

    let _ = channel.send(AgentStreamEvent::Done {
      finish_reason: "stop".to_string(),
    });
    stats
  }
}
