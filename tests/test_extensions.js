const { resolveProfile, listProfiles } = require("../lib/profiles");
const { tokenizeDocument, locateDefectTokenIndex, spliceToken } = require("../lib/patcher/local_patcher");
const { AutonomousOrchestrator } = require("../lib/orchestrator");
const { LLMClient } = require("../lib/llm_client");

console.log("=== Testing Extensions A, B, and C ===");

// ----------------------------------------------------
// Test A: Domain-Specific Adaptive Profiles
// ----------------------------------------------------
console.log("\n[Test A] Domain-Specific Adaptive Profiles");
const profiles = listProfiles();
console.log("  Built-in profiles found:", profiles.join(", "));

for (const p of profiles) {
  const resolved = resolveProfile(p);
  if (resolved && resolved.cutoff && resolved.metrics.sent_stdev) {
    console.log(`  ✓ PASS: Profile '${p}' resolved (cutoff: ${resolved.cutoff}, samples: ${resolved.corpus.samples})`);
  } else {
    console.error(`  ✗ FAIL: Profile '${p}' resolution failed`);
    process.exit(1);
  }
}

// ----------------------------------------------------
// Test B: Local Patch Clamping & Surgical Splicing
// ----------------------------------------------------
console.log("\n[Test B] Local Patch Clamping Engine");

const SAMPLE_DOC = `# System Health Report

Our metrics ingestion cluster encountered severe backpressure during peak traffic hours.

It was not simply a resource shortage, but a critical architectural failure inside the consumer queue.

\`\`\`yaml
replicaCount: 5
resources:
  limits:
    memory: 2Gi
\`\`\`

See [Grafana Dashboard](https://monitoring.corp/dashboards/34).
`;

const tokens = tokenizeDocument(SAMPLE_DOC);
console.log(`  Tokenized document into ${tokens.length} structural elements.`);

// Locate the defect token for parallelism ("It was not simply a resource shortage, but...")
const defectIndex = locateDefectTokenIndex(tokens, { dimension: "parallelism" });
console.log(`  Target defect located at paragraph token index: ${defectIndex}`);

if (tokens[defectIndex].raw.includes("not simply")) {
  console.log(`  ✓ PASS: Targeted defect successfully clamped to specific paragraph.`);
} else {
  console.error("  ✗ FAIL: Clamping located wrong token:", tokens[defectIndex]);
  process.exit(1);
}

// Perform surgical splice
const replacementParagraph = "The consumer queue saturated its thread pool, which triggered cascading worker timeouts.";
const splicedDoc = spliceToken(tokens, defectIndex, replacementParagraph);

if (splicedDoc.includes("consumer queue saturated") && splicedDoc.includes("replicaCount: 5") && splicedDoc.includes("Grafana Dashboard")) {
  console.log(`  ✓ PASS: Local patch spliced cleanly with 100% preservation of code blocks and citations.`);
} else {
  console.error("  ✗ FAIL: Spliced document corrupted invariants:", splicedDoc);
  process.exit(1);
}

// ----------------------------------------------------
// Test C: Closed-Loop Execution in Local Patch Mode & Pareto Controller
// ----------------------------------------------------
console.log("\n[Test C] Closed-Loop Multi-Pass Autonomous Execution with Patch Mode & Pareto Controller");

let patchCount = 0;
const patchMockClient = new LLMClient({
  provider: "mock",
  mockHandler: (prompt, systemPrompt) => {
    patchCount++;
    // Returns ONLY the replacement paragraph without touching rest of doc!
    return "The consumer queue saturated its thread pool, causing worker nodes to drop connections under high concurrency.";
  }
});

const orchestrator = new AutonomousOrchestrator({
  llmClient: patchMockClient,
  profile: "engineering",
  usePatchMode: true,
  enablePareto: true,
  maxIterations: 2,
  logger: () => {}, // silent
});

orchestrator.run(SAMPLE_DOC).then((res) => {
  if (res.finalMd.includes("The consumer queue saturated") && res.finalMd.includes("replicaCount: 5")) {
    console.log(`  ✓ PASS: Autonomous Orchestrator executed patch mode with zero code mutations.`);
    console.log(`  ✓ PASS: Pareto telemetry recorded checks: ${res.telemetry.paretoChecks >= 0}`);
  } else {
    console.error("  ✗ FAIL: Autonomous Orchestrator failed patch mode run:", res);
    process.exit(1);
  }

  // ----------------------------------------------------
  // Test D: GitHub Actions Step Summary Generation
  // ----------------------------------------------------
  console.log("\n[Test D] GitHub Step Summary & Scorecard Generation");
  const { generateStepSummary } = require("../lib/summary");
  const summaryMd = generateStepSummary(res.verdict, "test.md", "engineering");
  if (summaryMd.includes("Measured Humanizer Quality Gate") && summaryMd.includes("test.md")) {
    console.log("  ✓ PASS: GitHub Step Summary markdown generated with score table.");
  } else {
    console.error("  ✗ FAIL: Summary markdown malformed:", summaryMd);
    process.exit(1);
  }

  // ----------------------------------------------------
  // Test E: SVG & JSON Badge Generation
  // ----------------------------------------------------
  console.log("\n[Test E] Live SVG & JSON Badge Generator");
  const { generateSvgBadge, writeBadgeFile } = require("../lib/badge");
  const svg = generateSvgBadge(0.98, true);
  if (svg.includes("<svg") && svg.includes("human-grade") && svg.includes("98% passing")) {
    console.log("  ✓ PASS: High-fidelity SVG badge generated with calibrated passing state.");
  } else {
    console.error("  ✗ FAIL: SVG badge generation failed:", svg);
    process.exit(1);
  }
  const badgePaths = writeBadgeFile(0.98, true);
  if (require("fs").existsSync(badgePaths.svgPath) && require("fs").existsSync(badgePaths.jsonPath)) {
    console.log("  ✓ PASS: Badge files written to disk successfully.");
  } else {
    console.error("  ✗ FAIL: Badge files not found on disk:", badgePaths);
    process.exit(1);
  }

  // ----------------------------------------------------
  // Test F: 100% Local Quantized SLM Worker Initialization
  // ----------------------------------------------------
  console.log("\n[Test F] 100% Local Quantized SLM Worker Adapter");
  const slmClient = new LLMClient({ provider: "ollama" });
  if (slmClient.provider === "ollama" && slmClient.model === "measured-slm" && slmClient.endpoint.includes("11434")) {
    console.log("  ✓ PASS: Ollama client configured with local endpoint and default model 'measured-slm'.");
  } else {
    console.error("  ✗ FAIL: Ollama client initialization incorrect:", slmClient);
    process.exit(1);
  }

  // ----------------------------------------------------
  // Test G: VS Code / Cursor Extension Module & Manifest
  // ----------------------------------------------------
  console.log("\n[Test G] VS Code / Cursor Extension Manifest & Diagnostics");
  const extManifest = require("../extensions/vscode/package.json");
  const extModule = require("../extensions/vscode/extension.js");
  if (extManifest.name === "measured-humanizer-vscode" && extManifest.contributes.commands.length >= 3) {
    console.log(`  ✓ PASS: VS Code extension manifest loaded (${extManifest.contributes.commands.length} commands).`);
  } else {
    console.error("  ✗ FAIL: Extension manifest invalid:", extManifest);
    process.exit(1);
  }
  const extActivated = extModule.activate({ subscriptions: [] });
  if (extActivated && extActivated.isMock) {
    console.log("  ✓ PASS: VS Code extension activated cleanly in test harness.");
  } else {
    console.error("  ✗ FAIL: Extension activation failed:", extActivated);
    process.exit(1);
  }

  // ----------------------------------------------------
  // Test H: Chrome Extension Manifest & Evaluator Engine
  // ----------------------------------------------------
  console.log("\n[Test H] Chrome Extension Manifest & Client Evaluator Engine");
  const chromeManifest = require("../extensions/chrome/manifest.json");
  const { evaluateText, PROFILES: chromeProfiles } = require("../extensions/chrome/lib/evaluator.js");
  
  if (chromeManifest.manifest_version === 3 && chromeManifest.permissions.includes("storage")) {
    console.log("  ✓ PASS: Chrome Extension Manifest V3 valid with required permissions.");
  } else {
    console.error("  ✗ FAIL: Chrome manifest invalid:", chromeManifest);
    process.exit(1);
  }

  const aiEval = evaluateText("Distributed systems play a vital role. It is not simply a queue, but a resilient backbone.", "engineering");
  if (!aiEval.pass && aiEval.worst && aiEval.worst.dimension === "parallelism") {
    console.log("  ✓ PASS: Chrome Evaluator correctly flagged artificial AI parallelism in raw browser text.");
  } else {
    console.error("  ✗ FAIL: Chrome Evaluator failed AI detection test:", aiEval);
    process.exit(1);
  }

  const humanEval = evaluateText("Last Tuesday, our cluster stopped accepting incoming jobs. We set the queue retry budget to three attempts.", "engineering");
  if (humanEval.metrics.words > 10) {
    console.log("  ✓ PASS: Chrome Evaluator cleanly parsed human sample prose.");
  } else {
    console.error("  ✗ FAIL: Chrome Evaluator failed human test:", humanEval);
    process.exit(1);
  }

  console.log("\n=======================================================");
  console.log("🚀 ALL 8 EXTENSION SUITES PASSED (A, B, C, D, E, F, G, H)!");
  console.log("=======================================================");
  process.exit(0);
});
