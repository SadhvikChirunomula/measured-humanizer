# measured-humanizer

A Claude Code skill that makes writing read as human-written by **measuring it**,
not by pattern-matching a list of words someone decided sound like a robot.

Ships a dependency-free Node scorer calibrated against **36 human-written and 45
AI-written technical documents**. Point it at a draft and it returns the single
worst dimension plus an instruction for fixing it. Fix that one thing.
Re-measure. Repeat until it passes.

That loop terminates. "Make this sound more human" does not.

## Why not just use a list of AI tells?

Because the lists don't work. Here is what they actually measured on the corpus,
as AUC, where 0.5 is a coin flip:

| Signal | Separation | Verdict |
|---|---|---|
| hedging words (*may*, *might*, *typically*) | 0.516 | useless — humans hedged **more** |
| bridge phrases (*moreover*, *furthermore*) | 0.527 | useless — near-zero in both classes |
| promotional adjectives (*robust*, *seamless*, *leverage*) | 0.535 | useless — no consistent direction |

Banning the word "may" accomplishes nothing. Humans used it more than the
generated set did.

What separates the two classes is structural, and it isn't subtle:

| Dimension | Separation | Human | AI |
|---|---|---|---|
| paragraph length variance | **0.897** | 28.6 | 12.8 |
| first-person rate (/1k words) | **0.889** | 8.18 | 0.00 |
| em-dash rate | 0.736 | 0.00 | higher |
| sentence length variance | 0.720 | 10.3 | 7.7 |
| concrete-specific density | 0.686 | 28.0 | 19.9 |
| contraction rate | 0.663 | 10.2 | 7.9 |

AI writes paragraphs of near-uniform length and never says "we". Those two facts
carry more signal than every phrase list combined.

Full derivation, including the design mistakes found along the way, is in
[`skills/measured-humanizer/reference/calibration.md`](skills/measured-humanizer/reference/calibration.md).

## Install

**As a plugin** (recommended — updates with `/plugin`):

```
/plugin marketplace add SadhvikChirunomula/measured-humanizer
/plugin install measured-humanizer@measured-humanizer
```

**As a plain skill**, for the current user:

```bash
curl -fsSL https://raw.githubusercontent.com/SadhvikChirunomula/measured-humanizer/main/install.sh | bash
```

Or from a checkout, into one project only:

```bash
git clone https://github.com/SadhvikChirunomula/measured-humanizer.git
cd measured-humanizer
./install.sh              # ~/.claude/skills
./install.sh --project    # ./.claude/skills, this repo only
```

`install.sh` backs up any existing install rather than overwriting it, then runs
the gate once to prove it works. Node 14+ is the only requirement.

## Use

Ask Claude Code to humanize, de-slop, or audit a draft and the skill loads
itself. Or run the scorer directly:

```bash
GATE=~/.claude/skills/measured-humanizer/gate/style_gate.js

node "$GATE" draft.md --brief
```

```
pass=false composite=0.139/0.84 VETOED
failing=9: parallelism,discourse_markers,is_that_filler,long_word_rate,contraction_rate,para_stdev,first_person_rate,concrete_rate,sent_stdev
worst=parallelism value=3.08
fix: Remove every "not X, but Y" / "it isn't A, it's B" construction. This pattern appeared zero times across 36 human documents.
```

Drop `--brief` for the full JSON: every metric, every failure, the heading zones.

| Flag | Effect |
|---|---|
| `--brief` | Human-readable summary. Cheap enough to run inside an agent loop. |
| `--before old.md` | Integrity check. Fails if a fenced code block changed or a link was dropped. |
| `--no-zoning` | Skip the H2/H3 heading rules. Use for READMEs, design docs, email. |
| `--thresholds f.json` | Use your own calibration instead of the shipped one. |

Exit code is always 0 for a scored document; read `pass`. Exit 2 means bad usage.

### Integrity is the part people skip

```bash
cp draft.md draft.orig.md
# ...edit one dimension...
node "$GATE" draft.md --brief --before draft.orig.md
```

`integrity=false` means the edit damaged a code block or lost a citation. Roll
that pass back. A more human-sounding article that dropped its sources is a worse
article, and an LLM asked to "improve style" will quietly rewrite your shell
snippets if nothing is watching.

## Recalibrate it for your voice

The shipped thresholds are fitted to technical practitioner prose. Marketing
copy, fiction and academic writing each want their own fit, and using someone
else's ranges is how you end up with a gate that enforces a voice you don't want.

`gate/thresholds.json` holds the ranges, the AUC-derived weight per dimension,
and the swept cutoff. To refit: gather ~30+ documents per class in your domain,
run `metrics()` from `gate/style_gate.js` over both sets, keep dimensions with
AUC ≥ 0.65, set each range to the human percentile band, and sweep the cutoff for
best separation. Don't hand-edit the numbers — a guessed threshold is the
taste-based approach with extra steps.

## Test

```bash
./test/run.sh
```

14 assertions. Two fixtures carry the load: a document written to look generated
must fail and get vetoed, and one written the way the corpus measures must pass.
Run it after any change to the metrics or the thresholds — if either direction
breaks, the gate no longer separates the classes it claims to.

## What this is not

- **Not an AI-detector bypass.** It measures properties that separated one
  labelled corpus. That's a claim about prose, not about some classifier neither
  of us has seen. Held-out rates at the shipped cutoff are 75% of human documents
  passing and 11% of generated ones slipping through — a filter, not an oracle.
- **Not a substitute for having something to say.** Every dimension here is a
  proxy. A document contorted to hit the numbers is not good writing, it's a
  document that games a gate. The scorer tells you where to look; it doesn't know
  whether the argument holds.
- **Not domain-general as shipped.** See recalibration above.

## Licence

MIT. The corpora themselves are not redistributed — what ships is the fitted
result.
