#!/usr/bin/env bash
# Regression suite for the style gate. Run before any change to the metrics or
# the thresholds, and after recalibrating.
#
#   ./test/run.sh
#
# The two fixtures are the whole point: a document written to look generated must
# fail, and one written the way the corpus measures must pass. If a change to the
# gate breaks either direction, the gate no longer separates the classes it
# claims to separate.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE="$here/../skills/measured-humanizer/gate/style_gate.js"
FIX="$here/fixtures"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  ok    %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL  %s\n     expected: %s\n     got: %s\n' "$1" "$2" "$3"; }
check() { # check <name> <expected-substring> <actual>
  case "$3" in *"$2"*) ok "$1";; *) bad "$1" "$2" "$(echo "$3" | tr '\n' ' ')";; esac
}

echo "gate: $GATE"
command -v node >/dev/null 2>&1 || { echo "node not found on PATH" >&2; exit 1; }
echo

echo "separation"
check "human-shaped fixture passes" "pass=true" \
  "$(node "$GATE" "$FIX/human_shaped.md" --brief)"
check "ai-shaped fixture fails" "pass=false" \
  "$(node "$GATE" "$FIX/ai_shaped.md" --brief)"
check "ai-shaped fixture is vetoed" "VETOED" \
  "$(node "$GATE" "$FIX/ai_shaped.md" --brief)"
check "ai-shaped trips an absolute rule first" "worst=parallelism" \
  "$(node "$GATE" "$FIX/ai_shaped.md" --brief)"

echo
echo "thresholds"
# An empty threshold set scores composite 1 and passes everything, so a gate run
# without the calibrated file silently rubber-stamps. The sibling file must load
# by default.
check "sibling thresholds.json loads without --thresholds" "/0.84" \
  "$(node "$GATE" "$FIX/human_shaped.md" --brief)"
printf '{"metrics":{}}' > "$tmp/empty.json"
check "an empty threshold set is visibly not the default" "composite=1/0" \
  "$(node "$GATE" "$FIX/ai_shaped.md" --brief --thresholds "$tmp/empty.json")"

echo
echo "integrity"
cp "$FIX/human_shaped.md" "$tmp/orig.md"
check "untouched copy is intact" "integrity=true" \
  "$(node "$GATE" "$tmp/orig.md" --brief --before "$FIX/human_shaped.md")"

# Tamper inside the first fenced block, whatever its language tag is. Keying off
# ```bash meant a fixture without a language tag silently produced an identical
# file, and the test passed by comparing a document to itself.
node -e '
const fs = require("fs");
const md = fs.readFileSync(process.argv[1], "utf8");
const out = md.replace(/```[\s\S]*?```/, (b) => b.replace(/\n/, "\n# tampered\n"));
if (out === md) { console.error("fixture has no fenced block to tamper"); process.exit(1); }
fs.writeFileSync(process.argv[2], out);
' "$FIX/human_shaped.md" "$tmp/fence.md" || exit 1
check "a modified fenced block is caught" "code=false" \
  "$(node "$GATE" "$tmp/fence.md" --brief --before "$FIX/human_shaped.md")"

node -e '
const fs = require("fs");
const md = fs.readFileSync(process.argv[1], "utf8");
const u = [...md.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1])[0];
fs.writeFileSync(process.argv[2], md.split("](" + u + ")").join("]"));
' "$FIX/human_shaped.md" "$tmp/nolink.md"
check "a dropped citation is caught" "urls=false" \
  "$(node "$GATE" "$tmp/nolink.md" --brief --before "$FIX/human_shaped.md")"

echo
echo "heading zoning"
printf '# T\n\n## Is this a question?\n\nwe ran it and it worked, and the thing to watch here is the retry budget, which we set to three attempts.\n' > "$tmp/q.md"
check "a question H2 is vetoed in an article" "worst=question_h2_headings" \
  "$(node "$GATE" "$tmp/q.md" --brief)"
out="$(node "$GATE" "$tmp/q.md" --brief --no-zoning)"
case "$out" in
  *question_h2_headings*) bad "--no-zoning drops the H2 rule" "no question_h2_headings" "$out";;
  *) ok "--no-zoning drops the H2 rule";;
esac

echo
echo "cli contract"
node "$GATE" "$FIX/human_shaped.md" >/dev/null 2>&1
check "exit 0 on a scored document" "0" "$?"
node "$GATE" "$FIX/human_shaped.md" 2>/dev/null | node -e '
let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const j = JSON.parse(s);
  const need = ["pass", "composite", "cutoff", "vetoed", "metrics", "zones", "failures", "worst"];
  const missing = need.filter((k) => !(k in j));
  process.stdout.write(missing.length ? "missing:" + missing.join(",") : "shape=ok");
});' > "$tmp/shape" 2>/dev/null
check "full JSON carries every documented key" "shape=ok" "$(cat "$tmp/shape")"
node "$GATE" >/dev/null 2>&1
check "exit 2 with no argument" "2" "$?"

echo
printf '%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
