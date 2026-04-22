/// CDP (Chrome DevTools Protocol) browser tool.
/// Connects lazily to an already-running Chrome instance on first use.
///
/// Prerequisites: Chrome/Chromium started with --remote-debugging-port=9222
use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use reqwest::Client;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};

use crate::util::error::{KadaError, Result};

use super::{Tool, ToolContext};

// ── CDP Session ───────────────────────────────────────────────────────────────

type WsSink = futures_util::stream::SplitSink<
  tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
  WsMessage,
>;
type WsSource = futures_util::stream::SplitStream<
  tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
>;

pub struct CdpSession {
  sink: WsSink,
  source: WsSource,
  id_counter: u32,
}

impl CdpSession {
  async fn call(&mut self, method: &str, params: Value) -> Result<Value> {
    self.id_counter += 1;
    let id = self.id_counter;
    let msg = json!({ "id": id, "method": method, "params": params });
    let text = serde_json::to_string(&msg)?;

    self
      .sink
      .send(WsMessage::Text(text))
      .await
      .map_err(|e| KadaError::Tool(format!("CDP send failed: {e}")))?;

    // Wait for matching response
    let timeout = Duration::from_secs(10);
    let result = tokio::time::timeout(timeout, async {
      while let Some(msg) = self.source.next().await {
        match msg {
          Ok(WsMessage::Text(text)) => {
            if let Ok(val) = serde_json::from_str::<Value>(&text) {
              if val["id"].as_u64() == Some(id as u64) {
                if let Some(err) = val.get("error") {
                  return Err(KadaError::Tool(format!("CDP error: {}", err)));
                }
                return Ok(val["result"].clone());
              }
            }
          },
          Ok(WsMessage::Close(_)) => {
            return Err(KadaError::Tool("CDP connection closed".to_string()));
          },
          Err(e) => {
            return Err(KadaError::Tool(format!("CDP receive error: {e}")));
          },
          _ => {},
        }
      }
      Err(KadaError::Tool("CDP stream ended unexpectedly".to_string()))
    })
    .await
    .map_err(|_| KadaError::Timeout(format!("CDP call timed out: {method}")))?;

    result
  }
}

// ── BrowseTool ────────────────────────────────────────────────────────────────

pub struct BrowseTool {
  http: Client,
  session: Arc<Mutex<Option<CdpSession>>>,
}

impl BrowseTool {
  pub fn new() -> Self {
    Self {
      http: Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to build HTTP client"),
      session: Arc::new(Mutex::new(None)),
    }
  }

  /// Lazily connect to Chrome CDP on the given port.
  async fn get_session(&self, port: u16) -> Result<&Arc<Mutex<Option<CdpSession>>>> {
    let mut guard = self.session.lock().await;
    if guard.is_none() {
      // Discover WebSocket debugger URL
      let url = format!("http://127.0.0.1:{}/json", port);
      let resp: Vec<Value> = self
        .http
        .get(&url)
        .send()
        .await
        .map_err(|e| {
          KadaError::Tool(format!(
            "Cannot connect to Chrome on port {}. \
                         Make sure Chrome is running with --remote-debugging-port={}. Error: {e}",
            port, port
          ))
        })?
        .json()
        .await
        .map_err(|e| KadaError::Tool(format!("Invalid CDP JSON: {e}")))?;

      // Pick the first open tab
      let ws_url = resp
        .iter()
        .find(|tab| tab["type"].as_str() == Some("page"))
        .and_then(|tab| tab["webSocketDebuggerUrl"].as_str())
        .ok_or_else(|| KadaError::Tool("No open page tab found in Chrome".to_string()))?;

      let (ws_stream, _) = connect_async(ws_url)
        .await
        .map_err(|e| KadaError::Tool(format!("CDP WebSocket connect failed: {e}")))?;

      let (sink, source) = ws_stream.split();
      *guard = Some(CdpSession { sink, source, id_counter: 0 });
    }
    drop(guard);
    Ok(&self.session)
  }
}

#[async_trait]
impl Tool for BrowseTool {
  fn name(&self) -> &str {
    "browse"
  }

  fn description(&self) -> &str {
    "Control a Chrome browser via CDP. Actions: navigate, get_text, click, type_text, screenshot. \
         Requires Chrome running with --remote-debugging-port=9222."
  }

  fn parameters_schema(&self) -> Value {
    json!({
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["navigate", "get_text", "click", "type_text"],
                "description": "Action to perform"
            },
            "url": {
                "type": "string",
                "description": "URL to navigate to (required for 'navigate')"
            },
            "selector": {
                "type": "string",
                "description": "CSS selector for element (required for 'click' and 'type_text')"
            },
            "text": {
                "type": "string",
                "description": "Text to type (required for 'type_text')"
            }
        },
        "required": ["action"]
    })
  }

  async fn call(&self, ctx: &ToolContext, args: Value) -> Result<String> {
    let action = args["action"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: action".to_string()))?;

    let arc = self.get_session(ctx.cdp_port).await?;
    let mut guard = arc.lock().await;
    let session = guard
      .as_mut()
      .ok_or_else(|| KadaError::Tool("CDP session not available".to_string()))?;

    match action {
      "navigate" => {
        let url = args["url"]
          .as_str()
          .ok_or_else(|| KadaError::Tool("Missing parameter: url".to_string()))?;
        session.call("Page.navigate", json!({ "url": url })).await?;
        // Wait for load
        tokio::time::sleep(Duration::from_millis(800)).await;
        Ok(format!("Navigated to {url}"))
      },
      "get_text" => {
        let result = session
          .call(
            "Runtime.evaluate",
            json!({
                "expression": "document.body.innerText",
                "returnByValue": true
            }),
          )
          .await?;
        let text = result["result"]["value"].as_str().unwrap_or("").to_string();
        let truncated = if text.len() > 8_000 {
          format!("{}\n[truncated]", &text[..8_000])
        } else {
          text
        };
        Ok(truncated)
      },
      "click" => {
        let selector = args["selector"]
          .as_str()
          .ok_or_else(|| KadaError::Tool("Missing parameter: selector".to_string()))?;
        let escaped = selector.replace('\'', "\\'");
        let expr = format!(
                    "(() => {{ const el = document.querySelector('{}'); if(!el) throw new Error('Element not found: {}'); el.click(); return 'clicked'; }})()",
                    escaped, selector
                );
        session
          .call("Runtime.evaluate", json!({ "expression": expr, "returnByValue": true }))
          .await?;
        Ok(format!("Clicked element: {selector}"))
      },
      "type_text" => {
        let selector = args["selector"]
          .as_str()
          .ok_or_else(|| KadaError::Tool("Missing parameter: selector".to_string()))?;
        let text = args["text"]
          .as_str()
          .ok_or_else(|| KadaError::Tool("Missing parameter: text".to_string()))?;
        let text_escaped = text.replace('\'', "\\'");
        let sel_escaped = selector.replace('\'', "\\'");
        let expr = format!(
                    "(() => {{ const el = document.querySelector('{}'); if(!el) throw new Error('Element not found'); el.focus(); el.value = '{}'; el.dispatchEvent(new Event('input', {{bubbles: true}})); return 'typed'; }})()",
                    sel_escaped, text_escaped
                );
        session
          .call("Runtime.evaluate", json!({ "expression": expr, "returnByValue": true }))
          .await?;
        Ok(format!("Typed text into: {selector}"))
      },
      _ => Err(KadaError::Tool(format!("Unknown action: {action}"))),
    }
  }
}
