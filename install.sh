#!/usr/bin/env bash
# Install the measured-humanizer skill.
#
#   ./install.sh              install for the current user (~/.claude/skills)
#   ./install.sh --project    install into ./.claude/skills for this repo only
#
# Also works piped from the network, in which case it fetches the repo itself:
#   curl -fsSL https://raw.githubusercontent.com/SadhvikChirunomula/measured-humanizer/main/install.sh | bash
set -euo pipefail

REPO_URL="https://github.com/SadhvikChirunomula/measured-humanizer.git"
NAME="measured-humanizer"

dest_root="$HOME/.claude/skills"
[ "${1:-}" = "--project" ] && dest_root="$PWD/.claude/skills"

# Locate the skill payload. When piped from curl there is no script directory to
# copy from, so clone into a temp dir and clean it up on exit.
src=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  [ -d "$here/skills/$NAME" ] && src="$here/skills/$NAME"
fi
if [ -z "$src" ]; then
  command -v git >/dev/null 2>&1 || { echo "need git to fetch $NAME" >&2; exit 1; }
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  echo "fetching $NAME..."
  git clone --depth 1 --quiet "$REPO_URL" "$tmp/repo"
  src="$tmp/repo/skills/$NAME"
fi

command -v node >/dev/null 2>&1 || {
  echo "warning: node not found on PATH. The skill installs, but the gate needs node to run." >&2
}

dest="$dest_root/$NAME"
if [ -e "$dest" ]; then
  # Never clobber silently: someone may have recalibrated thresholds.json.
  backup="$dest.bak.$(date +%Y%m%d%H%M%S)"
  echo "existing install found, moving it to $backup"
  mv "$dest" "$backup"
fi

mkdir -p "$dest_root"
cp -R "$src" "$dest"

# Prove the install works rather than claiming it does.
if command -v node >/dev/null 2>&1; then
  probe="$(mktemp -d)"
  printf '# T\n\nwe ran it, and the retry budget we set to three attempts before giving up on the node entirely, which took a while.\n\nShort.\n' > "$probe/p.md"
  if node "$dest/gate/style_gate.js" "$probe/p.md" --brief >/dev/null 2>&1; then
    echo "gate runs: ok"
  else
    echo "gate failed to run - check your node version (needs 14+)" >&2
    rm -rf "$probe"; exit 1
  fi
  rm -rf "$probe"
fi

echo
echo "installed to $dest"
echo
echo "use it by asking Claude Code to \"humanize\" a draft, or directly:"
echo "  node $dest/gate/style_gate.js draft.md --brief"
