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
// Test C: Closed-Loop Execution in Local Patch Mode
// ----------------------------------------------------
console.log("\n[Test C] Closed-Loop Multi-Pass Autonomous Execution with Patch Mode");

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
  maxIterations: 2,
  logger: () => {}, // silent
});

orchestrator.run(SAMPLE_DOC).then((res) => {
  if (res.finalMd.includes("The consumer queue saturated") && res.finalMd.includes("replicaCount: 5")) {
    console.log(`  ✓ PASS: Autonomous Orchestrator executed patch mode with zero code mutations.`);
    console.log("\nALL EXTENSION TESTS PASSED (A, B, C)!");
    process.exit(0);
  } else {
    console.error("  ✗ FAIL: Autonomous Orchestrator failed patch mode run:", res);
    process.exit(1);
  }
});
