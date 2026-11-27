/**
 * Autonomous Orchestrator & Convergence Governor
 * Executes a deterministic closed-loop editing and verification architecture.
 *
 * Loop State Machine:
 *  1. Baseline Snapshot & Invariant Extraction
 *  2. Evaluate Current Metrics via Style Gate
 *  3. Termination Check (pass === true && no vetoes)
 *  4. Oscillation & Control Loop Damping Check
 *  5. Dispatch Surgical Edit Task targeting ONLY worst dimension
 *  6. AST Hardware-Style Interlock Verification (Hard Rollback on invariant break)
 *  7. State Commit & Next Iteration
 */

const fs = require("fs");
const path = require("path");
const { verifyAstIntegrity } = require("./ast_guard");

class AutonomousOrchestrator {
  constructor(options = {}) {
    this.styleGatePath = options.styleGatePath || path.join(__dirname, "..", "skills", "measured-humanizer", "gate", "style_gate.js");
    this.thresholdsPath = options.thresholdsPath || path.join(__dirname, "..", "skills", "measured-humanizer", "gate", "thresholds.json");
    
    const { gate } = require(this.styleGatePath);
    this.gateFn = gate;
    this.thresholds = JSON.parse(fs.readFileSync(this.thresholdsPath, "utf8"));
    
    this.llmClient = options.llmClient || null;
    this.maxIterations = options.maxIterations || 6;
    this.zoning = options.zoning !== false;
    this.logger = options.logger || console.log;
  }

  evaluate(currentMd, baselineMd = null) {
    return this.gateFn(currentMd, this.thresholds, baselineMd, { zoning: this.zoning });
  }

  async run(initialMd) {
    const baselineMd = initialMd;
    let currentMd = initialMd;
    const history = [];
    const dimensionHistory = [];

    this.logger(`[Orchestrator] Initializing Autonomous Verification Loop...`);
    this.logger(`[Orchestrator] Document size: ${currentMd.split(/\s+/).length} words`);

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      this.logger(`\n--- [Pass ${iteration}/${this.maxIterations}] Evaluating Document ---`);
      
      const verdict = this.evaluate(currentMd, baselineMd);
      
      history.push({
        iteration,
        composite: verdict.composite,
        cutoff: verdict.cutoff,
        pass: verdict.pass,
        vetoed: verdict.vetoed,
        failuresCount: verdict.failures.length,
        worstDimension: verdict.worst ? verdict.worst.dimension : null,
      });

      this.logger(`[Verdict] pass=${verdict.pass} composite=${verdict.composite.toFixed(3)}/${verdict.cutoff}${verdict.vetoed ? " (VETOED)" : ""}`);
      this.logger(`[Failing Dimensions] ${verdict.failures.map(f => f.dimension).join(", ") || "None (All within human range)"}`);

      // 1. Termination condition
      if (verdict.pass && !verdict.vetoed) {
        this.logger(`\n🎉 [CONVERGENCE ACHIEVED] Document satisfied all calibrated thresholds and absolute rules!`);
        return {
          success: true,
          iterations: iteration,
          finalMd: currentMd,
          history,
          verdict,
        };
      }

      const targetDefect = verdict.worst;
      if (!targetDefect) {
        this.logger(`[Notice] Score below cutoff (${verdict.composite}/${verdict.cutoff}) but no specific worst dimension flagged.`);
        break;
      }

      this.logger(`[Target Defect] Dimension: '${targetDefect.dimension}' (severity: ${targetDefect.severity || "standard"})`);
      this.logger(`[Fix Instruction] ${targetDefect.instruction}`);

      // 2. Oscillation Detection (Damping Governor)
      dimensionHistory.push(targetDefect.dimension);
      const recentOccurrences = dimensionHistory.filter(d => d === targetDefect.dimension).length;
      let dampingPrompt = "";
      if (recentOccurrences > 2) {
        this.logger(`⚠️ [Damping Governor] Oscillation detected on dimension '${targetDefect.dimension}'. Activating conservative damping.`);
        dampingPrompt = "\nCRITICAL DAMPING CONSTRAINT: Make minimal, conservative alterations. Do not touch previously adjusted sections.";
      }

      // 3. Dispatch to Editing Agent
      if (!this.llmClient) {
        throw new Error("Cannot run autonomous loop without an active LLMClient configured.");
      }

      const systemPrompt = `You are a surgical technical editor agent working inside a closed-loop verification pipeline.
Your job is to address ONE AND ONLY ONE defect without altering anything else.
CRITICAL INVARIANTS:
1. NEVER alter, delete, or reformat ANY fenced code blocks (\`\`\` ... \`\`\`). Keep verbatim!
2. NEVER remove, rewrite, or drop ANY hyperlinks or citations ([anchor](url)).
3. Keep all Markdown headings and tables structured accurately.
4. Output ONLY the updated markdown document. Do NOT include pleasantries, notes, or explanations outside the document.`;

      const prompt = `CURRENT FAILING DIMENSION:
Dimension: ${targetDefect.dimension}
Value: ${targetDefect.value}
Instruction: ${targetDefect.instruction}
${dampingPrompt}

DOCUMENT TO SURGICALLY EDIT:
${currentMd}`;

      this.logger(`[Editing Agent] Dispatching targeted rewrite prompt...`);
      const candidateRaw = await this.llmClient.complete(prompt, systemPrompt);
      
      // Clean candidate output if wrapped in outer markdown blocks
      let candidateMd = candidateRaw.trim();
      if (candidateMd.startsWith("```markdown\n") && candidateMd.endsWith("\n```")) {
        candidateMd = candidateMd.slice(12, -4);
      } else if (candidateMd.startsWith("```\n") && candidateMd.endsWith("\n```") && !candidateMd.slice(4).includes("```")) {
        candidateMd = candidateMd.slice(4, -4);
      }

      // 4. Non-Neural AST Integrity Guard (Hardware-Style Interlock)
      this.logger(`[AST Guard] Running cryptographic and AST invariant checks...`);
      const astCheck = verifyAstIntegrity(baselineMd, candidateMd);
      
      if (!astCheck.valid) {
        this.logger(`🚨 [HARD ROLLBACK] Invariant violation detected! Edit discarded.`);
        for (const v of astCheck.violations) {
          this.logger(`   - ${v.detail}`);
        }
        // Rollback current iteration edit to previous state and log violation
        continue;
      }

      this.logger(`✓ [AST Guard Passed] Fenced blocks, citations, and structural tables verified 100% intact.`);
      currentMd = candidateMd;
    }

    this.logger(`\n⚠️ [Max Iterations Exceeded] Loop terminated without reaching cutoff score.`);
    return {
      success: false,
      iterations: this.maxIterations,
      finalMd: currentMd,
      history,
      verdict: this.evaluate(currentMd, baselineMd),
    };
  }
}

module.exports = { AutonomousOrchestrator };
