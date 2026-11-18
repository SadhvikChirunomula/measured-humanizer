#!/usr/bin/env bash
# Install Measured Humanizer CLI and Claude Code skill.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/SadhvikChirunomula/measured-humanizer/main/install.sh | bash
#
# Or locally:
#   ./install.sh [options]
#
# Options:
#   --cli-only     Install only the standalone terminal CLI (~/.local/bin/measured-humanizer)
#   --skill-only   Install only the Claude Code skill (~/.claude/skills/measured-humanizer)
#   --project      Install skill locally into ./.claude/skills for the current workspace
#   --bin-dir DIR  Custom directory for CLI executable (default: ~/.local/bin)
#   --help, -h     Show this help message

set -euo pipefail

REPO_URL="https://github.com/SadhvikChirunomula/measured-humanizer.git"
NAME="measured-humanizer"

BIN_DIR="${HOME}/.local/bin"
SHARE_DIR="${HOME}/.local/share/${NAME}"
SKILL_DIR="${HOME}/.claude/skills/${NAME}"

INSTALL_CLI=true
INSTALL_SKILL=true

while [ $# -gt 0 ]; do
  case "$1" in
    --cli-only)
      INSTALL_SKILL=false
      shift
      ;;
    --skill-only)
      INSTALL_CLI=false
      shift
      ;;
    --project)
      SKILL_DIR="${PWD}/.claude/skills/${NAME}"
      shift
      ;;
    --bin-dir)
      BIN_DIR="$2"
      shift 2
      ;;
    -h|--help)
      cat <<EOF
Measured Humanizer Installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/SadhvikChirunomula/measured-humanizer/main/install.sh | bash

Or locally:
  ./install.sh [options]

Options:
  --cli-only     Install only the standalone terminal CLI (~/.local/bin/measured-humanizer)
  --skill-only   Install only the Claude Code skill (~/.claude/skills/measured-humanizer)
  --project      Install skill locally into ./.claude/skills for the current workspace
  --bin-dir DIR  Custom directory for CLI executable (default: ~/.local/bin)
  --help, -h     Show this help message
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "=== Measured Humanizer Installer ==="

# Check for node
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js (v14+) is required to run Measured Humanizer but was not found on PATH." >&2
  echo "Please install Node.js and re-run this script: https://nodejs.org/" >&2
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 14 ]; then
  echo "Warning: Detected Node.js $(node -v). Measured Humanizer recommends Node.js 14 or higher." >&2
fi

# Locate source files
src=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -d "$here/skills/$NAME" ]; then
    src="$here/skills/$NAME"
  fi
fi

tmp_repo=""
if [ -z "$src" ]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "Error: git is required to download Measured Humanizer." >&2
    exit 1
  fi
  tmp_repo="$(mktemp -d)"
  trap 'rm -rf "$tmp_repo"' EXIT
  echo "--> Downloading repository..."
  git clone --depth 1 --quiet "$REPO_URL" "$tmp_repo/repo"
  src="$tmp_repo/repo/skills/$NAME"
fi

# 1. Install CLI if requested
if [ "$INSTALL_CLI" = true ]; then
  echo "--> Installing CLI..."
  mkdir -p "$SHARE_DIR" "$BIN_DIR"
  cp -R "$src/." "$SHARE_DIR/"

  cat <<EOF > "$BIN_DIR/$NAME"
#!/usr/bin/env bash
exec node "$SHARE_DIR/gate/style_gate.js" "\$@"
EOF
  chmod +x "$BIN_DIR/$NAME"

  # Quick verification
  probe="$(mktemp -d)"
  printf '# Test Document\n\nwe ran it, and the retry budget we set to three attempts before giving up on the node entirely.\n\nShort.\n' > "$probe/p.md"
  if "$BIN_DIR/$NAME" "$probe/p.md" --brief >/dev/null 2>&1; then
    echo "    ✓ CLI executable installed to: $BIN_DIR/$NAME"
  else
    echo "    ✗ CLI installed but self-test failed" >&2
  fi
  rm -rf "$probe"

  # Check PATH
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
      echo ""
      echo "    [Notice] $BIN_DIR is not in your PATH."
      echo "    Add it to your shell configuration (e.g. ~/.bashrc or ~/.zshrc):"
      echo "      export PATH=\"$BIN_DIR:\$PATH\""
      echo ""
      ;;
  esac
fi

# 2. Install Claude Code Skill if requested
if [ "$INSTALL_SKILL" = true ]; then
  echo "--> Installing Claude Code skill..."
  if [ -e "$SKILL_DIR" ]; then
    backup="$SKILL_DIR.bak.$(date +%Y%m%d%H%M%S)"
    echo "    Backing up existing skill to: $backup"
    mv "$SKILL_DIR" "$backup"
  fi
  mkdir -p "$(dirname "$SKILL_DIR")"
  cp -R "$src" "$SKILL_DIR"
  echo "    ✓ Skill installed to: $SKILL_DIR"
fi

echo ""
echo "=== Installation Complete! ==="
echo "Try running:"
echo "  measured-humanizer <your-draft.md> --brief"
echo ""
echo "Or in Claude Code, ask:"
echo "  \"humanize this draft\""
