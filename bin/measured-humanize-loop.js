#!/usr/bin/env node
/**
 * Closed-Loop Autonomous Humanizer CLI
 * Usage:
 *   node bin/measured-humanize-loop.js <draft.md> [--out output.md] [--max 6]
 */

const fs = require("fs");
const path = require("path");
const { AutonomousOrchestrator } = require("../lib/orchestrator");
const { LLMClient } = require("../lib/llm_client");

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const outIdx = args.indexOf("--out");
  const maxIdx = args.indexOf("--max");
  const provIdx = args.indexOf("--provider");
  const profIdx = args.indexOf("--profile");
  const noPatch = args.includes("--no-patch");

  if (!file) {
    console.error("Usage: node bin/measured-humanize-loop.js <draft.md> [--out output.md] [--profile engineering|executive|marketing|academic] [--max 6] [--provider anthropic|openai|ollama] [--no-patch]");
    process.exit(2);
  }

  const inputMd = fs.readFileSync(file, "utf8");
  const maxIterations = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) : 6;
  const provider = provIdx >= 0 ? args[provIdx + 1] : (process.env.LLM_PROVIDER || "anthropic");
  const profile = profIdx >= 0 ? args[profIdx + 1] : "engineering";

  const llmClient = new LLMClient({ provider });
  const orchestrator = new AutonomousOrchestrator({
    llmClient,
    maxIterations,
    profile,
    usePatchMode: !noPatch,
  });

  try {
    const result = await orchestrator.run(inputMd);
    if (outIdx >= 0) {
      const outPath = args[outIdx + 1];
      fs.writeFileSync(outPath, result.finalMd, "utf8");
      console.log(`\nFinal document written to: ${outPath}`);
    } else {
      console.log(`\n--- FINAL VERDICT SUMMARY ---`);
      console.log(`Success: ${result.success}`);
      console.log(`Passes: ${result.iterations}`);
      console.log(`Composite Score: ${result.verdict.composite.toFixed(3)}/${result.verdict.cutoff}`);
    }
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error(`\nFatal error in autonomous loop: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
