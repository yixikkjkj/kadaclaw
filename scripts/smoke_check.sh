#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_step() {
  local label="$1"
  shift
  echo
  echo "==> $label"
  "$@"
}

print_manual_checks() {
  local os_name
  os_name="$(uname -s)"

  echo
  echo "==> Manual validation checklist"
  echo "1. Run \`yarn tauri:dev\`."
  echo "2. Open Settings > Runtime Hub."
  echo "3. Click \`安装内置 OpenClaw\` or \`升级内置 OpenClaw\`."
  echo "4. Confirm the \`安装后自检\` panel reports:"
  echo "   - CLI 命令路径: 通过"
  echo "   - 版本读取: 通过"
  echo "   - 技能目录写入: 通过"
  echo "5. Click \`启动已安装 Runtime\`, then re-run self check."
  echo "6. Confirm \`HTTP 探测\` changes to 通过."
  echo "7. Open Skills Market and install one public ClawHub skill."
  echo "8. Confirm Installed page shows the skill and local manifest paths."

  echo
  echo "==> Platform notes"
  case "$os_name" in
    Darwin)
      echo "- macOS: bundled installer uses the official shell installer."
      ;;
    Linux)
      echo "- Linux: bundled installer uses the official shell installer."
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      echo "- Windows: bundled installer uses the official PowerShell installer."
      echo "- If install or launch fails, validate PowerShell, PATH, and the OpenClaw installer dependency on Node.js/npm; prefer WSL2 when needed."
      ;;
    *)
      echo "- Unknown host: verify shell/PowerShell availability before running bundled install."
      ;;
  esac
}

cd "$ROOT_DIR"

run_step "Type and Rust checks" yarn run check
run_step "Frontend build" yarn build
print_manual_checks
