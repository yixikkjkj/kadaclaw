#![allow(dead_code)]

use serde_json::{json, Value};

use crate::util::constants::MINIMAX_PROVIDER_KEY;

pub fn provider_env_name(provider: &str) -> Option<&'static str> {
  match provider {
    "anthropic" => Some("ANTHROPIC_API_KEY"),
    "openai" => Some("OPENAI_API_KEY"),
    "custom" => Some("OPENAI_API_KEY"),
    "openrouter" => Some("OPENROUTER_API_KEY"),
    "deepseek" => Some("DEEPSEEK_API_KEY"),
    "minimax" => Some("MINIMAX_API_KEY"),
    "google" => Some("GEMINI_API_KEY"),
    _ => None,
  }
}

pub fn provider_from_model(model: &str) -> String {
  match model
    .split('/')
    .next()
    .filter(|value| !value.trim().is_empty())
    .unwrap_or("anthropic")
  {
    MINIMAX_PROVIDER_KEY => "minimax".to_string(),
    value => value.to_string(),
  }
}

pub fn read_minimax_provider_api_key(root: &Value) -> Option<String> {
  root
    .get("models")
    .and_then(|value| value.get("providers"))
    .and_then(|value| value.get(MINIMAX_PROVIDER_KEY))
    .and_then(|value| value.get("apiKey"))
    .and_then(Value::as_str)
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(ToString::to_string)
}

pub fn build_minimax_model_entry(model: &str) -> Value {
  let model_id = model
    .split_once('/')
    .map(|(_, value)| value)
    .filter(|value| !value.trim().is_empty())
    .unwrap_or(model)
    .trim()
    .to_string();
  let model_name = model_id.replacen("MiniMax-", "MiniMax ", 1);

  json!({
    "contextWindow": 200000,
    "cost": {
      "input": 0.001,
      "output": 0.004,
    },
    "id": model_id,
    "name": model_name,
  })
}
