const fs = require("fs");
const path = require("path");
const { verifyAstIntegrity, sha256 } = require("../lib/ast_guard");
const { AutonomousOrchestrator } = require("../lib/orchestrator");
const { LLMClient } = require("../lib/llm_client");

const BASE_DOC = `# System Architecture

We designed the ingestion worker to process incoming batches with high reliability.

\`\`\`javascript
function processBatch(jobs) {
  return jobs.map(j => j.id);
}
\`\`\`

Refer to [Documentation](https://example.com/docs) for configuration.

| Service | Port |
|---------|------|
| API     | 8080 |
| Worker  | 8081 |
`;

console.log("=== Autonomous Architecture Verification Suite ===");

// Test 1: AST Integrity Guard (Valid untouched edit)
console.log("\n[Test 1] AST Guard on untouched valid text");
const check1 = verifyAstIntegrity(BASE_DOC, BASE_DOC + "\nAdditional genuine text.");
if (check1.valid) {
  console.log("  ok    Untouched code and links verified intact");
} else {
  console.error("  FAIL  Expected valid, got:", check1.violations);
  process.exit(1);
}

// Test 2: AST Integrity Guard (Fenced block mutation caught)
console.log("\n[Test 2] AST Guard catches tampered fenced code block");
const tamperedCode = BASE_DOC.replace("j.id", "j.uuid_mutated");
const check2 = verifyAstIntegrity(BASE_DOC, tamperedCode);
if (!check2.valid && check2.violations[0].type === "FENCED_BLOCK_MUTATED") {
  console.log("  ok    Fenced block mutation caught and flagged");
} else {
  console.error("  FAIL  Expected FENCED_BLOCK_MUTATED, got:", check2);
  process.exit(1);
}

// Test 3: AST Integrity Guard (Dropped citation caught)
console.log("\n[Test 3] AST Guard catches dropped source citation");
const droppedLink = BASE_DOC.replace("https://example.com/docs", "");
const check3 = verifyAstIntegrity(BASE_DOC, droppedLink);
if (!check3.valid && check3.violations.some(v => v.type === "CITATIONS_DROPPED")) {
  console.log("  ok    Dropped link detected and flagged");
} else {
  console.error("  FAIL  Expected CITATIONS_DROPPED, got:", check3);
  process.exit(1);
}

// Test 4: Closed-Loop Multi-Agent Convergence Simulation
console.log("\n[Test 4] Closed-Loop Multi-Agent Convergence Simulation");

const humanFixturePath = path.join(__dirname, "fixtures", "human_shaped.md");
const humanPassingDraft = fs.readFileSync(humanFixturePath, "utf8");

// Create an initial draft that fails 1 veto rule but preserves code blocks & URLs
const draftWithParallelism = humanPassingDraft.replace(
  "The storm stopped.",
  "The storm stopped. It was not simply an error, but a critical architectural lesson."
);

let passCount = 0;
const mockClient = new LLMClient({
  provider: "mock",
  mockHandler: (prompt) => {
    passCount++;
    // Pass 1: Targeted edit addresses the parallelism defect while preserving code blocks & URLs
    return humanPassingDraft;
  }
});

const orchestrator = new AutonomousOrchestrator({
  llmClient: mockClient,
  maxIterations: 3,
  usePatchMode: false,
  logger: () => {}, // silent in test
});

orchestrator.run(draftWithParallelism).then((result) => {
  if (result.success && result.iterations === 2) {
    console.log(`  ok    Multi-agent closed loop converged in ${result.iterations} iterations`);
    console.log(`  ok    Final composite score: ${result.verdict.composite.toFixed(2)}/${result.verdict.cutoff}`);
    console.log("\nALL 4 AUTONOMOUS ARCHITECTURE TESTS PASSED!");
  } else {
    console.error("  FAIL  Convergence simulation failed:", result);
    process.exit(1);
  }
});
