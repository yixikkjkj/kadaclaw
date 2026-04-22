use thiserror::Error;

#[derive(Debug, Error)]
pub enum KadaError {
  #[error("{0}")]
  Provider(String),
  #[error("{0}")]
  Tool(String),
  #[error("{0}")]
  Skill(String),
  #[error("{0}")]
  Config(String),
  #[error("{0}")]
  Http(String),
  #[error("{0}")]
  PermissionDenied(String),
  #[error("{0}")]
  NotFound(String),
  #[error("{0}")]
  Timeout(String),
  #[error(transparent)]
  Io(#[from] std::io::Error),
  #[error(transparent)]
  Json(#[from] serde_json::Error),
  #[error(transparent)]
  Reqwest(#[from] reqwest::Error),
}

pub type Result<T> = std::result::Result<T, KadaError>;

impl From<KadaError> for String {
  fn from(e: KadaError) -> Self {
    e.to_string()
  }
}
