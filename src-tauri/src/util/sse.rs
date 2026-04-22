pub fn parse_sse_event_block(block: &str) -> Option<(Option<String>, String)> {
  let mut event_type: Option<String> = None;
  let mut data_lines = Vec::new();

  for line in block.lines() {
    if let Some(value) = line.strip_prefix("event:") {
      let normalized = value.trim();
      if !normalized.is_empty() {
        event_type = Some(normalized.to_string());
      }
      continue;
    }

    if let Some(value) = line.strip_prefix("data:") {
      data_lines.push(value.trim_start().to_string());
    }
  }

  if data_lines.is_empty() {
    return None;
  }

  Some((event_type, data_lines.join("\n")))
}
