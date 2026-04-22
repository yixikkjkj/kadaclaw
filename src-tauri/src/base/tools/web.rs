use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;

use crate::util::error::{KadaError, Result};

use super::{Tool, ToolContext};

// ── HTML-to-text helper ───────────────────────────────────────────────────────

fn html_to_text(html: &str) -> String {
  use scraper::{Html, Selector};

  let document = Html::parse_document(html);

  // Remove script/style elements from consideration
  let body_selector = Selector::parse("body").unwrap();
  let text_selector = Selector::parse("p, h1, h2, h3, h4, li, td, th, pre, code, blockquote").unwrap();

  // Try structured extraction first
  if let Some(body) = document.select(&body_selector).next() {
    let _ = body; // just confirm body exists
  }

  let mut parts: Vec<String> = Vec::new();
  for el in document.select(&text_selector) {
    let text = el.text().collect::<Vec<_>>().join(" ");
    let text = text.trim().to_string();
    if !text.is_empty() {
      parts.push(text);
    }
  }

  if parts.is_empty() {
    // Fallback: strip all tags
    let stripped = html5ever_plain_text(html);
    stripped
  } else {
    parts.join("\n")
  }
}

fn html5ever_plain_text(html: &str) -> String {
  // Simple regex-based tag stripper as fallback
  let re = regex::Regex::new(r"<[^>]+>").unwrap();
  let text = re.replace_all(html, " ");
  // Collapse whitespace
  let ws = regex::Regex::new(r"\s{2,}").unwrap();
  ws.replace_all(&text, "\n").trim().to_string()
}

// ── web_fetch ─────────────────────────────────────────────────────────────────

pub struct WebFetchTool {
  client: Client,
}

impl WebFetchTool {
  pub fn new() -> Self {
    Self {
      client: Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (compatible; KadaBot/1.0)")
        .build()
        .expect("Failed to build HTTP client"),
    }
  }
}

#[async_trait]
impl Tool for WebFetchTool {
  fn name(&self) -> &str {
    "web_fetch"
  }

  fn description(&self) -> &str {
    "Fetch a web page and return its text content. HTML is converted to readable plain text."
  }

  fn parameters_schema(&self) -> Value {
    json!({
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "URL to fetch"
            }
        },
        "required": ["url"]
    })
  }

  async fn call(&self, _ctx: &ToolContext, args: Value) -> Result<String> {
    let url = args["url"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: url".to_string()))?;

    // Validate URL scheme
    if !url.starts_with("http://") && !url.starts_with("https://") {
      return Err(KadaError::Tool("URL must use http:// or https://".to_string()));
    }

    let response = self
      .client
      .get(url)
      .send()
      .await
      .map_err(|e| KadaError::Http(format!("Fetch failed: {e}")))?;

    let status = response.status().as_u16();
    let content_type = response
      .headers()
      .get("content-type")
      .and_then(|v| v.to_str().ok())
      .unwrap_or("")
      .to_string();

    let body = response
      .text()
      .await
      .map_err(|e| KadaError::Http(format!("Read body failed: {e}")))?;

    if status >= 400 {
      return Err(KadaError::Http(format!("HTTP {}: {}", status, url)));
    }

    let text = if content_type.contains("text/html") || content_type.contains("application/xhtml") {
      html_to_text(&body)
    } else {
      body
    };

    // Truncate to 10k chars to avoid overwhelming context
    let truncated = if text.len() > 10_000 {
      format!("{}\n\n[truncated — {} chars total]", &text[..10_000], text.len())
    } else {
      text
    };

    Ok(format!("URL: {}\nStatus: {}\n\n{}", url, status, truncated))
  }
}

// ── web_search ────────────────────────────────────────────────────────────────

pub struct WebSearchTool {
  client: Client,
}

impl WebSearchTool {
  pub fn new() -> Self {
    Self {
      client: Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (compatible; KadaBot/1.0)")
        .build()
        .expect("Failed to build HTTP client"),
    }
  }

  /// DuckDuckGo HTML search — parses result blocks from the HTML response
  async fn search_duckduckgo(&self, query: &str) -> Result<Vec<SearchResult>> {
    let url = format!("https://html.duckduckgo.com/html/?q={}", urlencoding::encode(query));

    let html = self
      .client
      .get(&url)
      .send()
      .await
      .map_err(|e| KadaError::Http(format!("DuckDuckGo fetch failed: {e}")))?
      .text()
      .await
      .map_err(|e| KadaError::Http(format!("DuckDuckGo body read failed: {e}")))?;

    Ok(parse_ddg_results(&html))
  }

  /// Tavily API search
  async fn search_tavily(&self, query: &str, api_key: &str) -> Result<Vec<SearchResult>> {
    let resp: Value = self
      .client
      .post("https://api.tavily.com/search")
      .json(&json!({
          "api_key": api_key,
          "query": query,
          "search_depth": "basic",
          "max_results": 5
      }))
      .send()
      .await
      .map_err(|e| KadaError::Http(format!("Tavily fetch failed: {e}")))?
      .json()
      .await
      .map_err(|e| KadaError::Http(format!("Tavily JSON parse failed: {e}")))?;

    let results = resp["results"]
      .as_array()
      .map(|arr| {
        arr
          .iter()
          .filter_map(|r| {
            Some(SearchResult {
              title: r["title"].as_str()?.to_string(),
              url: r["url"].as_str()?.to_string(),
              snippet: r["content"].as_str().unwrap_or("").to_string(),
            })
          })
          .collect()
      })
      .unwrap_or_default();

    Ok(results)
  }
}

struct SearchResult {
  title: String,
  url: String,
  snippet: String,
}

fn parse_ddg_results(html: &str) -> Vec<SearchResult> {
  use scraper::{Html, Selector};

  let document = Html::parse_document(html);
  let result_sel = Selector::parse(".result").unwrap_or_else(|_| Selector::parse("div").unwrap());
  let title_sel = Selector::parse(".result__title a, a.result__a").ok();
  let snippet_sel = Selector::parse(".result__snippet").ok();
  let url_sel = Selector::parse(".result__url, .result__extras__url").ok();

  let mut results = Vec::new();

  for result in document.select(&result_sel).take(8) {
    let title = title_sel
      .as_ref()
      .and_then(|sel| result.select(sel).next())
      .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
      .unwrap_or_default();

    if title.is_empty() {
      continue;
    }

    let url = url_sel
      .as_ref()
      .and_then(|sel| result.select(sel).next())
      .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
      .unwrap_or_default();

    let snippet = snippet_sel
      .as_ref()
      .and_then(|sel| result.select(sel).next())
      .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
      .unwrap_or_default();

    results.push(SearchResult { title, url, snippet });
  }

  results
}

#[async_trait]
impl Tool for WebSearchTool {
  fn name(&self) -> &str {
    "web_search"
  }

  fn description(&self) -> &str {
    "Search the web and return a list of relevant results with titles, URLs, and snippets."
  }

  fn parameters_schema(&self) -> Value {
    json!({
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query"
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum results to return (default: 5)",
                "minimum": 1,
                "maximum": 10
            }
        },
        "required": ["query"]
    })
  }

  async fn call(&self, ctx: &ToolContext, args: Value) -> Result<String> {
    let query = args["query"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: query".to_string()))?;
    let max = args["max_results"].as_u64().unwrap_or(5).min(10) as usize;

    let results = if ctx.web_search_provider == "tavily" {
      match &ctx.tavily_api_key {
        Some(key) => self.search_tavily(query, key).await?,
        None => return Err(KadaError::Config("Tavily API key not configured".to_string())),
      }
    } else {
      self.search_duckduckgo(query).await?
    };

    if results.is_empty() {
      return Ok(format!("No results found for: {}", query));
    }

    let mut output = format!("Search results for: {}\n\n", query);
    for (i, r) in results.into_iter().take(max).enumerate() {
      output.push_str(&format!("{}. {}\n   {}\n   {}\n\n", i + 1, r.title, r.url, r.snippet));
    }
    Ok(output.trim().to_string())
  }
}
