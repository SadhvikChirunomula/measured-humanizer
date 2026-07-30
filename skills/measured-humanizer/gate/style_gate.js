#!/usr/bin/env node
// Deterministic style gate for the humanize loop.
//
// PORTABLE COPY. The authoritative version lives in the n8n blog pipeline at
// render/gate/style_gate.js; this one is standalone (defaults to the sibling
// thresholds.json, adds --brief, and checks every fenced block for integrity
// rather than only mermaid). Keep the metric definitions in sync - they are
// what the calibrated thresholds were fitted against.
//
// Runs INSIDE the n8n container, which has node but no python3 - so this file
// is the single runtime implementation. `scripts/calibrate_gates.py` derives
// the thresholds offline; `scripts/validate_gate.js` proves this code separates
// the human corpus from the AI corpus before it is allowed to gate anything.
//
// Design notes that came out of calibration against 36 human + 45 AI documents:
//
//   * Ranges are TWO-SIDED. A one-sided floor on sentence variance is satisfied
//     by injecting a single stray four-word sentence, which games the gate
//     without improving the prose.
//   * The classic "AI tell" phrase lists (hedging, bridge phrases, promotional
//     adjectives) measured at chance on the real corpus - hedging was actually
//     MORE common in human writing. They are scored for reporting but are NOT
//     gated on. What actually separates the corpora is structural: paragraph
//     length variance, first-person rate, sentence variance, contractions.
//   * "not X, but Y" parallelism occurred 0 times in 36 human documents and 8
//     times in the AI set, so it is treated as a zero-tolerance rule rather
//     than a calibrated range - a low base rate makes it a poor range metric
//     but a fine absolute one.
//
// Usage:
//   node style_gate.js <file.md> [--thresholds t.json] [--before pre.md]
// Emits a JSON verdict on stdout. Exit code is always 0; read `pass`.

const fs = require("fs");

// ---------------------------------------------------------------- patterns

const HEDGES = [/\bmay\b/gi, /\bmight\b/gi, /\bcould be\b/gi, /\bit is worth noting\b/gi,
  /\bworth noting\b/gi, /\bgenerally speaking\b/gi, /\btends? to\b/gi, /\brelatively\b/gi,
  /\bfairly\b/gi, /\bsomewhat\b/gi, /\bin many cases\b/gi, /\btypically\b/gi];
const BRIDGES = [/\bmoreover\b/gi, /\bfurthermore\b/gi, /\badditionally\b/gi,
  /\bin conclusion\b/gi, /\bthat said\b/gi, /\bultimately\b/gi, /\bin today's\b/gi,
  /\bwhen it comes to\b/gi, /\bplays a (?:crucial|vital|key) role\b/gi];
const PARALLELISM = [/\bnot (?:just |merely |simply )?[\w\s]{2,30}, but\b/gi,
  /\bisn't (?:just |merely )?[\w\s]{2,30}, it's\b/gi,
  /\bit's not [\w\s]{2,30}, it's\b/gi];
const PROMO = [/\bseamless(?:ly)?\b/gi, /\brobust\b/gi, /\bcutting-edge\b/gi,
  /\bleverage\b/gi, /\bharness\b/gi, /\bempower\b/gi, /\bunlock\b/gi,
  /\bstreamline\b/gi, /\bdelve\b/gi, /\bpivotal\b/gi];
// Discourse markers. Named by an external reviewer as the giveaway, and they
// measured 1.30/1k in generated text against 0.00 in the human corpus - unlike
// the classic hedging/bridge-phrase lists, which measured at chance and are
// correctly not gated.
const DISCOURSE = [/\bthe real problem is\b/gi, /\bthe trade-?off is\b/gi,
  /\bthe catch is\b/gi, /\bnone of (?:this|that) means\b/gi,
  /\bthe mistake is\b/gi, /\bthe point is\b/gi, /\bthe fix is\b/gi,
  /\bthe question becomes\b/gi, /\bthe (?:problem|issue) is that\b/gi,
  /\bworth adopting\b/gi, /\bthe lesson is\b/gi];
// `X is that Y` filler: 0.82/1k generated vs 0.24 human.
const IS_THAT = [/\b(?:is|was)\s+that\b/gi];
const CONTRACTIONS = [/\b\w+['’](?:s|t|re|ve|ll|d|m)\b/gi];
const FIRST_PERSON = [/\b(?:we|our|us|i|my)\b/gi];
const EMDASH = [/—/g];
const CONCRETE = [
  /\b\d+(?:\.\d+)?\s*(?:%|x|ms|s|GB|TB|MB|KB|vCPU|cores?|nodes?)\b/gi,
  /\bv?\d+\.\d+(?:\.\d+)?\b/g,
  /\b[a-z]+[._-][a-z._-]{3,}\b/g,
  /--[a-z][a-z-]+/g,
  /\b[A-Z][A-Z_]{4,}\b/g,
];

// ---------------------------------------------------------------- helpers

// Strip fenced code and inline code before measuring prose: a code block would
// otherwise dominate sentence-length statistics.
function proseOnly(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " CODE ")
    .replace(/^\s{0,3}(#{1,6})\s+.*$/gm, " ")   // headings are not prose
    .replace(/^\s*\|.*\|\s*$/gm, " ");          // table rows are not prose
}

function sentences(text) {
  return text
    .split(/(?<!\b[A-Z])(?<!\d)[.!?]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);
}

function pstdev(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

function rate(pats, text, words) {
  let n = 0;
  for (const p of pats) n += (text.match(p) || []).length;
  return Math.round((1000 * n) / Math.max(words, 1) * 100) / 100;
}

// ---------------------------------------------------------------- metrics

function metrics(md) {
  const text = proseOnly(md);
  const words = text.split(/\s+/).filter(Boolean).length;
  const sents = sentences(text);
  const lens = sents.map((s) => s.split(/\s+/).filter(Boolean).length);
  const paras = text.split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.split(/\s+/).filter(Boolean).length >= 10);
  const plens = paras.map((p) => p.split(/\s+/).filter(Boolean).length);
  const r2 = (x) => Math.round(x * 100) / 100;

  return {
    words,
    sentences: sents.length,
    sent_mean: lens.length ? r2(lens.reduce((a, b) => a + b, 0) / lens.length) : 0,
    sent_stdev: r2(pstdev(lens)),
    short_ratio: lens.length ? r2(lens.filter((x) => x <= 8).length / lens.length) : 0,
    long_ratio: lens.length ? r2(lens.filter((x) => x >= 25).length / lens.length) : 0,
    para_stdev: r2(pstdev(plens)),
    hedge_rate: rate(HEDGES, text, words),
    bridge_rate: rate(BRIDGES, text, words),
    parallelism_rate: rate(PARALLELISM, text, words),
    promo_rate: rate(PROMO, text, words),
    contraction_rate: rate(CONTRACTIONS, text, words),
    first_person_rate: rate(FIRST_PERSON, text, words),
    emdash_rate: rate(EMDASH, text, words),
    concrete_rate: rate(CONCRETE, text, words),
    discourse_marker_rate: rate(DISCOURSE, text, words),
    is_that_rate: rate(IS_THAT, text, words),
    // Human practitioners write DENSER prose than we do - they name components
    // where we paraphrase them. This is the largest single divergence measured.
    long_word_rate: (() => {
      const w = text.toLowerCase().match(/[a-z']+/g) || [];
      return w.length ? Math.round((1000 * w.filter((x) => x.length >= 9).length / w.length) * 100) / 100 : 0;
    })(),
  };
}

// ------------------------------------------------------- absolute rules

// Zoning is by HEADING LEVEL, matching workflows/style/geo_spec.md:
//   H2 = descriptive statement (questions banned)
//   H3 = literal reader question (questions required - the citation surface)
//
// An earlier version keyed off a whitelist of what/why/how/when/which and
// vetoed anything else. That flagged "Can two processes write to the same
// DuckDB file at once?" and "Is the multi-writer problem actually solved now?"
// as violations - headings the GEO spec explicitly requires. The two gates
// contradicted each other and every well-formed article was vetoed.
function headingZones(md) {
  const heads = [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)]
    .map((m) => ({ level: m[1].length, text: m[2].trim() }));
  const questionH2 = heads.filter((h) => h.level === 2 && h.text.endsWith("?")).map((h) => h.text);
  const questionH3 = heads.filter((h) => h.level === 3 && h.text.endsWith("?")).map((h) => h.text);
  const statementH3 = heads.filter((h) => h.level === 3 && !h.text.endsWith("?")).map((h) => h.text);
  return { questionH2, questionH3, statementH3 };
}

// What the humanizer must never damage. Failure here rolls back to `before`.
function integrity(before, after) {
  // Every fenced block, not just mermaid: a style edit has no business touching
  // any code sample, and a rewritten shell snippet is a worse regression than a
  // rewritten diagram.
  const fences = (s) => s.match(/```[\s\S]*?```/g) || [];
  const urls = (s) => new Set([...s.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]));
  const cb = fences(before), ca = fences(after);
  const ub = urls(before), ua = urls(after);
  const missing = [...ub].filter((u) => !ua.has(u));
  const codeIntact = cb.length === ca.length && cb.every((x, i) => x === ca[i]);
  return { codeIntact, mermaidIntact: codeIntact,
    urlsIntact: missing.length === 0, missingUrls: missing,
    ok: codeIntact && missing.length === 0 };
}

// ---------------------------------------------------------------- gate

// opts.zoning (default true) enforces the GEO article shape: H2 descriptive,
// H3 questions. Turn it off for prose that is not a structured article - a
// README, a design doc, an email - where an H2 question is not a defect.
function gate(md, thresholds, before, opts) {
  const m = metrics(md);
  const zones = headingZones(md);
  const failures = [];

  // Calibrated two-sided ranges, only for metrics that actually discriminate.
  for (const [name, t] of Object.entries((thresholds && thresholds.metrics) || {})) {
    const v = m[name];
    if (v === undefined) continue;
    if (v < t.lo || v > t.hi) {
      // Normalised distance so dimensions are comparable when picking the worst.
      const span = Math.max(t.hi - t.lo, 1e-6);
      const dist = v < t.lo ? (t.lo - v) / span : (v - t.hi) / span;
      failures.push({
        dimension: name, value: v, lo: t.lo, hi: t.hi,
        severity: Math.round(dist * 1000) / 1000, strength: t.strength,
        instruction: v < t.lo
          ? `${name} is ${v}, below the human range [${t.lo}, ${t.hi}]. Raise it.`
          : `${name} is ${v}, above the human range [${t.lo}, ${t.hi}]. Lower it.`,
      });
    }
  }

  // Absolute rules - not calibrated, not negotiable.
  //
  // These two CANNOT be calibrated from the corpora, and that is the point:
  // both the human class and the AI class measure 0.00, while our own output
  // measures 0.80 and 0.74. AUC against those corpora is blind to a defect
  // neither class exhibits, so a calibrated range would never catch it. The
  // reference corpora describe good writing; they do not describe how THIS
  // generator fails.
  // Severity must be >= 9 to trip `vetoed` below - anything less is scored but
  // not enforced. These two were shipped at 8 and 7, so the "not negotiable"
  // claim above was false: an article at discourse_marker_rate 0.88 (more than
  // double the 0.4 line) passed at composite 1 because neither dimension is in
  // the calibrated `chosen` set either. Caught when run 17 shipped exactly that.
  if (m.discourse_marker_rate > 0.4) {
    failures.push({
      dimension: "discourse_markers", value: m.discourse_marker_rate, severity: 9,
      instruction: 'Remove formulaic transitions: "the real problem is", "the tradeoff is", ' +
        '"the catch is", "none of this means", "the mistake is", "the point is". ' +
        "These measure 0.00 in both the human and the reference corpora.",
    });
  }
  if (m.is_that_rate > 0.4) {
    failures.push({
      dimension: "is_that_filler", value: m.is_that_rate, severity: 9,
      instruction: 'Rewrite "X is that Y" constructions ("The problem is that...", ' +
        '"What this means is that..."). State the thing directly. Runs 0.82/1k in ' +
        "generated text against 0.24 in human writing.",
    });
  }
  if (m.parallelism_rate > 0) {
    failures.push({
      dimension: "parallelism", value: m.parallelism_rate, severity: 10,
      instruction: 'Remove every "not X, but Y" / "it isn\'t A, it\'s B" construction. ' +
        "This pattern appeared zero times across 36 human documents.",
    });
  }
  if ((!opts || opts.zoning !== false) && zones.questionH2.length > 0) {
    failures.push({
      dimension: "question_h2_headings", value: zones.questionH2.length, severity: 9,
      instruction: "Rewrite these H2 headings as descriptive statements. Questions belong " +
        "at H3, where they are required: " + zones.questionH2.join(" | "),
    });
  }

  failures.sort((a, b) => b.severity - a.severity);

  // Composite score, not all-must-pass. Requiring every dimension in-range
  // rejects genuine human writing outright - measured at 0% pass for BOTH
  // classes before this was fixed. Each dimension contributes its
  // discriminating strength, and the cutoff is swept from the corpus by
  // calibrate_gate.js rather than guessed.
  const chosen = (thresholds && thresholds.metrics) || {};
  const totalW = Object.values(chosen).reduce((s, t) => s + t.strength, 0);
  let earned = 0;
  for (const [k, t] of Object.entries(chosen)) {
    if (m[k] !== undefined && m[k] >= t.lo && m[k] <= t.hi) earned += t.strength;
  }
  const composite = totalW ? Math.round((earned / totalW) * 1000) / 1000 : 1;
  const cutoff = (thresholds && thresholds.cutoff) !== undefined ? thresholds.cutoff : 0;

  // Absolute rules are hard vetoes and bypass the composite score entirely.
  const vetoed = failures.some((f) => f.severity >= 9);

  const result = {
    pass: composite >= cutoff && !vetoed,
    composite,
    cutoff,
    vetoed,
    metrics: m,
    zones,
    failures,
    // One dimension per pass is what makes the loop converge instead of
    // trading one failing check off against another.
    worst: failures.length ? failures[0] : null,
  };
  if (before !== undefined && before !== null) result.integrity = integrity(before, md);
  return result;
}

module.exports = { metrics, gate, integrity, headingZones, proseOnly, sentences };

if (require.main === module) {
  const path = require("path");
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const tIdx = args.indexOf("--thresholds");
  const bIdx = args.indexOf("--before");
  if (!file) {
    console.error("usage: node style_gate.js <file.md> [--brief] [--before pre.md] " +
                  "[--no-zoning] [--thresholds t.json]");
    process.exit(2);
  }
  // Default to the thresholds shipped alongside this file. An empty threshold
  // set scores composite 1 and passes everything, so a missing --thresholds
  // used to look like a clean article instead of an unconfigured gate.
  const tPath = tIdx >= 0 ? args[tIdx + 1] : path.join(__dirname, "thresholds.json");
  const thresholds = JSON.parse(fs.readFileSync(tPath, "utf8"));
  const before = bIdx >= 0 ? fs.readFileSync(args[bIdx + 1], "utf8") : null;
  const out = gate(fs.readFileSync(file, "utf8"), thresholds, before,
                   { zoning: !args.includes("--no-zoning") });

  // --brief exists for agent loops: the full verdict is ~1.5KB of JSON per
  // pass, and the loop only ever acts on `worst`.
  if (args.includes("--brief")) {
    const w = out.worst;
    const lines = [
      `pass=${out.pass} composite=${out.composite}/${out.cutoff}${out.vetoed ? " VETOED" : ""}`,
      `failing=${out.failures.length}${out.failures.length ? ": " + out.failures.map((f) => f.dimension).join(",") : ""}`,
    ];
    if (w) lines.push(`worst=${w.dimension} value=${w.value}` +
      (w.lo !== undefined ? ` range=[${w.lo},${w.hi}]` : "") + `\nfix: ${w.instruction}`);
    if (out.integrity) lines.push(`integrity=${out.integrity.ok}` +
      (out.integrity.ok ? "" : ` code=${out.integrity.codeIntact} urls=${out.integrity.urlsIntact} lost=${out.integrity.missingUrls.join(",")}`));
    console.log(lines.join("\n"));
  } else {
    console.log(JSON.stringify(out, null, 1));
  }
}
