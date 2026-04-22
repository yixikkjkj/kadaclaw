use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::ipc::Channel;
use tokio::sync::mpsc;

use crate::base::providers::{ChatMessage, Provider, StreamChunk};
use crate::base::tools::{DynTool, ToolContext};

use super::context::ConversationContext;
use super::stream::AgentStreamEvent;

/// The main agent loop. Owns provider, tools, context, and streams events to frontend.
pub struct AgentRuntime {
  provider: Arc<dyn Provider>,
  tools: Vec<DynTool>,
  tool_context: ToolContext,
  system_prompt: String,
  max_tool_rounds: u32,
}

impl AgentRuntime {
  pub fn new(
    provider: Arc<dyn Provider>,
    tools: Vec<DynTool>,
    tool_context: ToolContext,
    system_prompt: String,
    max_tool_rounds: u32,
  ) -> Self {
    Self {
      provider,
      tools,
      tool_context,
      system_prompt,
      max_tool_rounds,
    }
  }

  /// Get tool schemas for passing to the LLM.
  fn tool_schemas(&self) -> Vec<Value> {
    self.tools.iter().map(|t| t.schema()).collect()
  }

  /// Run the agent for a single user turn, streaming events via Tauri Channel.
  pub async fn run(
    &self,
    ctx: &mut ConversationContext,
    user_message: &str,
    channel: Channel<AgentStreamEvent>,
    stop_flag: Arc<AtomicBool>,
  ) {
    ctx.add(ChatMessage::user(user_message));

    for round in 0..self.max_tool_rounds {
      if stop_flag.load(Ordering::Relaxed) {
        let _ = channel.send(AgentStreamEvent::Done {
          finish_reason: "stopped".to_string(),
        });
        return;
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
          return;
        }

        match chunk {
          StreamChunk::TextDelta { delta } => {
            full_text.push_str(&delta);
            let _ = channel.send(AgentStreamEvent::TextDelta { delta });
          },
          StreamChunk::Done {
            finish_reason: fr,
            tool_calls: tcs,
          } => {
            finish_reason = fr;
            tool_calls = tcs;
          },
          StreamChunk::Error { message } => {
            let _ = channel.send(AgentStreamEvent::Error { message });
            had_error = true;
            break;
          },
        }
      }

      if had_error {
        return;
      }

      // Add assistant reply to context
      if tool_calls.is_empty() {
        ctx.add(ChatMessage::assistant_text(&full_text));
        let _ = channel.send(AgentStreamEvent::Done { finish_reason });
        return;
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

        let result = if let Some(tool) = self.tools.iter().find(|t| t.name() == tool_name) {
          match tool.call(&self.tool_context, args).await {
            Ok(output) => output,
            Err(e) => format!("Tool error: {e}"),
          }
        } else {
          format!("Tool not found: {tool_name}")
        };

        let _ = channel.send(AgentStreamEvent::ToolCallResult {
          id: tool_id.clone(),
          name: tool_name.clone(),
          result: result.clone(),
        });

        ctx.add(ChatMessage::tool_result(&tool_id, &result));
      }

      // If we've used all rounds, stop
      if round + 1 >= self.max_tool_rounds {
        let _ = channel.send(AgentStreamEvent::Error {
          message: format!("Reached max tool call rounds ({})", self.max_tool_rounds),
        });
        return;
      }
    }

    let _ = channel.send(AgentStreamEvent::Done {
      finish_reason: "stop".to_string(),
    });
  }
}
