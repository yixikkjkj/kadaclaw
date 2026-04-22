use std::env;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

pub fn ensure_parent_dir(path: &Path) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| format!("无法创建目录 {}: {error}", parent.display()))?;
  }
  Ok(())
}

pub fn copy_directory_recursive(source_dir: &Path, target_dir: &Path) -> Result<(), String> {
  fs::create_dir_all(target_dir).map_err(|error| format!("无法创建目录 {}: {error}", target_dir.display()))?;

  let entries = fs::read_dir(source_dir).map_err(|error| format!("无法读取目录 {}: {error}", source_dir.display()))?;

  for entry in entries {
    let entry = entry.map_err(|error| format!("读取目录条目失败: {error}"))?;
    let source_path = entry.path();
    let target_path = target_dir.join(entry.file_name());

    if source_path.is_dir() {
      copy_directory_recursive(&source_path, &target_path)?;
    } else {
      ensure_parent_dir(&target_path)?;
      fs::copy(&source_path, &target_path)
        .map_err(|error| format!("无法复制文件 {} -> {}: {error}", source_path.display(), target_path.display()))?;
    }
  }

  Ok(())
}

pub fn create_temp_subdir(prefix: &str) -> Result<PathBuf, String> {
  let stamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|duration| duration.as_millis())
    .unwrap_or(0);
  let directory = env::temp_dir().join(format!("kadaclaw-{prefix}-{stamp}"));
  fs::create_dir_all(&directory).map_err(|error| format!("无法创建临时目录 {}: {error}", directory.display()))?;
  Ok(directory)
}

pub fn extract_zip_bytes_to_dir(bytes: &[u8], target_dir: &Path) -> Result<(), String> {
  let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|error| format!("无法解析技能压缩包: {error}"))?;

  for index in 0..archive.len() {
    let mut entry = archive
      .by_index(index)
      .map_err(|error| format!("无法读取压缩包条目: {error}"))?;
    let Some(relative_path) = entry.enclosed_name().map(|value| value.to_path_buf()) else {
      continue;
    };
    let output_path = target_dir.join(relative_path);

    if entry.is_dir() {
      fs::create_dir_all(&output_path)
        .map_err(|error| format!("无法创建解压目录 {}: {error}", output_path.display()))?;
      continue;
    }

    ensure_parent_dir(&output_path)?;
    let mut output_file =
      fs::File::create(&output_path).map_err(|error| format!("无法写入解压文件 {}: {error}", output_path.display()))?;
    std::io::copy(&mut entry, &mut output_file)
      .map_err(|error| format!("无法解压文件 {}: {error}", output_path.display()))?;
  }

  Ok(())
}
