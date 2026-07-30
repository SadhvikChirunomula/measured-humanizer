# Calibration provenance

Where the numbers in `gate/thresholds.json` and `SKILL.md` came from. Nothing in
either file is asserted from intuition — if a rule is here, it was measured, and
if it was measured and did not separate the classes, it is not gated on.

## The corpora

| Class | n | What it is |
|---|---|---|
| human | 36 | Public practitioner technical writing — engineering blog posts and long-form technical discussion threads, all written before generative tooling was in common use for this kind of prose |
| ai | 45 | Generated technical articles on the same subject matter |

The corpora themselves are not redistributed with this skill. What ships is the
fitted result: per-dimension ranges, AUC-derived weights, and the swept cutoff.

Held-out expectation at cutoff 0.84, recorded in `thresholds.json`:

```
humanPass 0.75   aiPass 0.11   separation 0.64
```

So roughly three in four genuine human documents pass and about one in nine
generated documents sneaks through. This is a filter, not an oracle.

## What did not discriminate

The single most useful finding, because it contradicts the standard advice.
Separation is AUC; 0.5 is a coin flip.

| Signal | AUC | Note |
|---|---|---|
| hedging words | 0.516 | Humans hedged **more**: 81 uses across 19/36 human docs vs 41 across 23/45 AI docs |
| bridge phrases (*moreover*, *furthermore*) | 0.527 | Near-zero base rate in both classes |
| promotional adjectives (*robust*, *seamless*, *leverage*) | 0.535 | No consistent direction |
| "not X, but Y" parallelism | 0.556 | Too sparse to fit a range, but 0 occurrences in 36 human docs vs 8 in the AI set — kept as an absolute ban instead |

These are still computed and reported by `metrics()` so you can see them. They
are deliberately absent from the gated set.

## What did discriminate

| Dimension | AUC | Human | AI |
|---|---|---|---|
| `para_stdev` — paragraph length variance | 0.897 | 28.6 | 12.8 |
| `first_person_rate` — we/our/us/I/my per 1k words | 0.889 | 8.18 | 0.00 |
| `long_word_rate` — words ≥ 9 chars per 1k | 0.74 | denser | sparser |
| `emdash_rate` | 0.736 | 0.00 | higher |
| `sent_stdev` — sentence length variance | 0.720 | 10.3 | 7.7 |
| `concrete_rate` — versions, flags, identifiers, units | 0.686 | 28.0 | 19.9 |
| `contraction_rate` | 0.663 | 10.2 | 7.9 |

The inclusion rule was AUC ≥ 0.65. Every range is the human percentile band, and
`strength` in `thresholds.json` is the AUC, used as the composite weight.

## Design decisions that came out of calibration

**Ranges are two-sided.** A floor alone on `sent_stdev` is satisfied by injecting
one stray four-word sentence. That moves the metric without improving the prose,
which is the definition of a gameable gate.

**Composite, not all-must-pass.** Requiring every dimension in range measured 0%
pass for *both* classes. A gate that rejects all genuine human writing is not
strict, it is broken. Each dimension contributes its AUC, and the cutoff was
swept for best separation rather than picked.

**Absolute rules are separate from the fit, and have to be.** `discourse_markers`
and `is_that_filler` measure ~0.00 in *both* reference classes, while observed
generated output measured 0.80 and 0.74 per 1k. AUC against those corpora is
structurally blind to a defect neither class exhibits. The corpora describe good
writing; they do not describe how any particular generator fails. Add rules here
from output you have actually looked at.

A worked example of why that matters: one article shipped at
`discourse_marker_rate: 0.88`, more than double the 0.4 line, with
`composite: 1, pass: true`. The rule existed, was documented "not negotiable",
and was assigned a severity below the veto threshold, so it scored the failure
and then passed the document anyway. Severity must be ≥ 9 to veto.

**Zone headings by level, never by opening word.** An earlier revision whitelisted
what/why/how/when/which and vetoed every other question form. It flagged
"Can two processes write to the same file at once?" and "Is the multi-writer
problem actually solved now?" — both exactly the shape the spec asked for. Every
well-formed document was vetoed.

**One dimension per pass.** Measured on a production pipeline: fixing several
dimensions in one edit trades one failing check against another and the loop
stops converging.

## Register, and what the corpus is not

The human corpus informs sentence *texture* — how much length varies, how often
people use contractions and first person. It is **not** a register model. A
document that reads like a forum post is a failure however human it measures.

Aim for formal technical long-form: procedural and explanatory, explain the
mechanism, name the parts, give the steps. Not conversational, not marketing.
