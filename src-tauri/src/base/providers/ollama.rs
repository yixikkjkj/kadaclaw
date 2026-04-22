use super::openai::OpenAIProvider;
use super::{ChatMessage, LLMResponse, Provider, StreamChunk};
/// Ollama provider — uses the OpenAI-compatible /v1/chat/completions endpoint.
/// Ollama 0.1.14+ ships this endpoint, so we can reuse OpenAIProvider.
use crate::util::error::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::sync::mpsc;

pub struct OllamaProvider {
  inner: OpenAIProvider,
}

impl OllamaProvider {
  pub fn new(api_base: Option<&str>, model: &str) -> Self {
    let base = api_base.unwrap_or("http://localhost:11434").trim_end_matches('/');
    // Ollama's OpenAI-compatible endpoint is at /v1
    let v1_base = if base.ends_with("/v1") { base.to_string() } else { format!("{}/v1", base) };
    Self {
      inner: OpenAIProvider::new("ollama", Some(&v1_base), model),
    }
  }
}

#[async_trait]
impl Provider for OllamaProvider {
  async fn chat(&self, messages: &[ChatMessage], tools: &[Value]) -> Result<LLMResponse> {
    self.inner.chat(messages, tools).await
  }

  async fn chat_stream(&self, messages: &[ChatMessage], tools: &[Value], tx: mpsc::Sender<StreamChunk>) -> Result<()> {
    self.inner.chat_stream(messages, tools, tx).await
  }
}
