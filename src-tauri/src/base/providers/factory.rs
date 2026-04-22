use std::sync::Arc;

use crate::base::models::AgentConfig;
use crate::util::error::{KadaError, Result};

use super::{anthropic::AnthropicProvider, ollama::OllamaProvider, openai::OpenAIProvider, Provider};

/// Create a Provider from the active_provider in config.
pub fn create_provider(config: &AgentConfig) -> Result<Arc<dyn Provider>> {
  let provider_id = &config.active_provider;
  let provider_cfg = config.providers.get(provider_id).ok_or_else(|| {
    KadaError::Config(format!("Provider '{}' not found in config. Please configure it in settings.", provider_id))
  })?;

  let model = &provider_cfg.model;
  let api_base = provider_cfg.api_base.as_deref();
  let api_key = provider_cfg.api_key.as_deref().unwrap_or("");

  let provider: Arc<dyn Provider> = match provider_id.as_str() {
    "ollama" => Arc::new(OllamaProvider::new(api_base, model)),
    p if p.starts_with("anthropic") || model.starts_with("claude") => {
      Arc::new(AnthropicProvider::new(api_key, api_base, model))
    },
    _ => Arc::new(OpenAIProvider::new(api_key, api_base, model)),
  };

  Ok(provider)
}
