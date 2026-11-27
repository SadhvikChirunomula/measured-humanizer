/**
 * Measured Humanizer - Client-Side Evaluator Engine
 * Ported from style_gate.js for browser environments (zero external dependencies).
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MeasuredEvaluator = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  
  const PROFILES = {
    engineering: {
      cutoff: 0.84,
      minParaStdev: 14.37,
      minSentStdev: 8.48,
      minFpRate: 0.73,
      minContRate: 5.12,
      maxParallelism: 0.35,
    },
    executive: {
      cutoff: 0.82,
      minParaStdev: 12.0,
      minSentStdev: 7.2,
      minFpRate: 0.0,
      minContRate: 2.0,
      maxParallelism: 0.30,
    },
    marketing: {
      cutoff: 0.80,
      minParaStdev: 16.0,
      minSentStdev: 9.5,
      minFpRate: 1.5,
      minContRate: 8.0,
      maxParallelism: 0.25,
    },
    academic: {
      cutoff: 0.82,
      minParaStdev: 11.0,
      minSentStdev: 6.8,
      minFpRate: 0.0,
      minContRate: 0.0,
      maxParallelism: 0.20,
    }
  };

  const CONCRETE_NOUNS = new Set([
    "disk", "cpu", "memory", "cache", "socket", "packet", "port", "node", "pod",
    "cluster", "host", "thread", "process", "core", "server", "table", "index",
    "query", "row", "column", "key", "shard", "replica", "buffer", "log", "queue",
    "lock", "mutex", "client", "worker", "broker", "proxy", "gateway", "service",
    "container", "image", "kernel", "driver", "pipe", "stream", "byte", "page"
  ]);

  function splitSentences(text) {
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  function evaluateText(rawText, profileName = "engineering") {
    if (!rawText || !rawText.trim()) {
      return {
        pass: true,
        composite: 1.0,
        cutoff: 0.84,
        metrics: {},
        failures: [],
        worst: null
      };
    }

    const profile = PROFILES[profileName] || PROFILES.engineering;
    
    // Strip fenced code blocks and headings for prose measurement
    const prose = rawText
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^#{1,6}\s+.*$/gm, "")
      .trim();

    const words = (prose.match(/\b[a-zA-Z0-9'-]+\b/g) || []);
    const wordCount = words.length || 1;

    // Paragraph variance
    const paras = prose.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const paraLens = paras.map(p => (p.match(/\b[a-zA-Z0-9'-]+\b/g) || []).length);
    const pMean = paraLens.reduce((a, b) => a + b, 0) / (paraLens.length || 1);
    const paraStdev = Math.sqrt(paraLens.reduce((acc, l) => acc + Math.pow(l - pMean, 2), 0) / (paraLens.length || 1));

    // Sentence variance (burstiness)
    const sents = splitSentences(prose);
    const sentLens = sents.map(s => (s.match(/\b[a-zA-Z0-9'-]+\b/g) || []).length);
    const sMean = sentLens.reduce((a, b) => a + b, 0) / (sentLens.length || 1);
    const sentStdev = Math.sqrt(sentLens.reduce((acc, l) => acc + Math.pow(l - sMean, 2), 0) / (sentLens.length || 1));

    // First person rate
    const firstPersonMatches = (prose.match(/\b(we|our|us|i|my|we're|we've|we'll)\b/gi) || []).length;
    const fpRate = (firstPersonMatches / wordCount) * 1000;

    // Contraction rate
    const contractionMatches = (prose.match(/\b[a-z]+'(?:t|re|ve|m|ll|d|s)\b/gi) || []).length;
    const contRate = (contractionMatches / wordCount) * 1000;

    // Concrete noun density
    const concreteCount = words.filter(w => CONCRETE_NOUNS.has(w.toLowerCase())).length;
    const concreteRate = (concreteCount / wordCount) * 1000;

    // Parallelism check ("not X, but Y", "it isn't A, it's B")
    const parallelismMatches = prose.match(/\b(?:not (?:just |merely |simply )?[\w\s]{2,30}, but|isn't (?:just |merely )?[\w\s]{2,30}, it's|it's not [\w\s]{2,30}, it's)\b/gi) || [];
    const hasParallelism = parallelismMatches.length > 0;

    const failures = [];

    // Rule 1: Banned AI antithesis parallelism (severity 9 = veto)
    if (hasParallelism) {
      failures.push({
        dimension: "parallelism",
        severity: 9,
        value: parallelismMatches.length,
        instruction: 'Remove artificial "not X, but Y" / "it isn\'t A, it\'s B" setup. State the reality directly.'
      });
    }

    // Rule 2: Paragraph length variance
    if (paras.length >= 2 && paraStdev < profile.minParaStdev) {
      failures.push({
        dimension: "paragraph_variance",
        severity: 6,
        value: paraStdev.toFixed(1),
        instruction: `Vary paragraph pacing (stdev ${paraStdev.toFixed(1)} < ${profile.minParaStdev}). Mix 1-sentence punch paragraphs with longer technical context.`
      });
    }

    // Rule 3: Sentence burstiness
    if (sents.length >= 3 && sentStdev < profile.minSentStdev) {
      failures.push({
        dimension: "sentence_burstiness",
        severity: 6,
        value: sentStdev.toFixed(1),
        instruction: `Increase sentence variance (stdev ${sentStdev.toFixed(1)} < ${profile.minSentStdev}). Mix 4-word punchy statements with longer explanations.`
      });
    }

    // Rule 4: First person voice (if required by profile)
    if (profile.minFpRate > 0 && fpRate < profile.minFpRate) {
      failures.push({
        dimension: "first_person",
        severity: 5,
        value: fpRate.toFixed(1),
        instruction: `Adopt genuine practitioner perspective ("we discovered", "our test failed"). Current: ${fpRate.toFixed(1)}/1k (min: ${profile.minFpRate}).`
      });
    }

    // Rule 5: Natural contractions
    if (profile.minContRate > 0 && contRate < profile.minContRate) {
      failures.push({
        dimension: "contractions",
        severity: 4,
        value: contRate.toFixed(1),
        instruction: `Use natural spoken contractions ("didn't", "we've", "it's"). Current: ${contRate.toFixed(1)}/1k (min: ${profile.minContRate}).`
      });
    }

    // Calculate composite score (1.0 - deductions)
    let penalty = 0;
    for (const f of failures) {
      if (f.severity >= 9) penalty += 0.40;
      else if (f.severity >= 6) penalty += 0.15;
      else penalty += 0.08;
    }
    const composite = Math.max(0.20, Math.min(1.0, 1.0 - penalty));
    const pass = composite >= profile.cutoff && !failures.some(f => f.severity >= 9);

    return {
      pass,
      composite,
      cutoff: profile.cutoff,
      profile: profileName,
      metrics: {
        words: wordCount,
        paragraphs: paras.length,
        sentences: sents.length,
        paraStdev: Number(paraStdev.toFixed(2)),
        sentStdev: Number(sentStdev.toFixed(2)),
        fpRate: Number(fpRate.toFixed(2)),
        contRate: Number(contRate.toFixed(2)),
        concreteRate: Number(concreteRate.toFixed(2)),
      },
      failures,
      worst: failures.length > 0 ? failures[0] : null
    };
  }

  return {
    PROFILES,
    evaluateText
  };
});
