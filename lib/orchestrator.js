/**
 * Autonomous Orchestrator & Convergence Governor
 * Supports:
 *   - Domain Profiles (engineering, executive, marketing, academic)
 *   - Local Patch Clamping (surgically edits only target paragraph tokens)
 *   - Non-Neural AST Integrity Guard (Hardware-Style Interlock)
 *   - Oscillation Damping Governor
 */

const fs = require("fs");
const path = require("path");
const { verifyAstIntegrity } = require("./ast_guard");
const { resolveProfile } = require("./profiles");
const { tokenizeDocument, locateDefectTokenIndex, spliceToken } = require("./patcher/local_patcher");

class AutonomousOrchestrator {
  constructor(options = {}) {
    this.styleGatePath = options.styleGatePath || path.join(__dirname, "..", "skills", "measured-humanizer", "gate", "style_gate.js");
    const { gate } = require(this.styleGatePath);
    this.gateFn = gate;

    // Resolve profile thresholds
    this.profileName = options.profile || "engineering";
    this.thresholds = options.thresholds || resolveProfile(this.profileName);

    this.llmClient = options.llmClient || null;
    this.maxIterations = options.maxIterations || 6;
    this.zoning = options.zoning !== false;
    this.usePatchMode = options.usePatchMode !== false; // default true: local patch clamping
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
    this.logger(`[Orchestrator] Active Profile: '${this.profileName}' (cutoff: ${this.thresholds.cutoff})`);
    this.logger(`[Orchestrator] Document size: ${currentMd.split(/\s+/).length} words | Patch mode: ${this.usePatchMode ? "Active" : "Full Doc"}`);

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
      this.logger(`[Failing Dimensions] ${verdict.failures.map(f => f.dimension).join(", ") || "None (All within profile range)"}`);

      // 1. Termination condition
      if (verdict.pass && !verdict.vetoed) {
        this.logger(`\n🎉 [CONVERGENCE ACHIEVED] Document satisfied all calibrated thresholds and rules!`);
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
        dampingPrompt = "\nCRITICAL DAMPING CONSTRAINT: Make minimal, conservative alterations.";
      }

      // 3. Dispatch to Editing Agent
      if (!this.llmClient) {
        throw new Error("Cannot run autonomous loop without an active LLMClient configured.");
      }

      let candidateMd = "";

      if (this.usePatchMode) {
        // --- LOCAL PATCH CLAMPING MODE ---
        const tokens = tokenizeDocument(currentMd);
        const targetIndex = locateDefectTokenIndex(tokens, targetDefect);
        const targetToken = tokens[targetIndex];

        this.logger(`[Patch Engine] Clamped edit to paragraph token #${targetIndex + 1} (${targetToken.raw.slice(0, 45)}...)`);

        const patchSystemPrompt = `You are a surgical paragraph editor.
Your task is to rewrite ONLY the provided single paragraph to resolve a specific defect.
CRITICAL CONSTRAINTS:
1. Output ONLY the rewritten replacement paragraph. Do NOT add markdown fences, intros, or commentary.
2. Keep the surrounding context in mind.
3. Fix the specific style dimension requested without adding fluff or wordiness.`;

        const patchPrompt = `DEFECT TO FIX:
Dimension: ${targetDefect.dimension}
Instruction: ${targetDefect.instruction}
${dampingPrompt}

PARAGRAPH TO REWRITE:
${targetToken.raw}`;

        const patchedRaw = await this.llmClient.complete(patchPrompt, patchSystemPrompt);
        candidateMd = spliceToken(tokens, targetIndex, patchedRaw.trim());
      } else {
        // --- FULL DOCUMENT REWRITE MODE ---
        const fullSystemPrompt = `You are a surgical technical editor agent working inside a closed-loop verification pipeline.
Your job is to address ONE AND ONLY ONE defect without altering anything else.
CRITICAL INVARIANTS:
1. NEVER alter, delete, or reformat ANY fenced code blocks (\`\`\` ... \`\`\`). Keep verbatim!
2. NEVER remove, rewrite, or drop ANY hyperlinks or citations ([anchor](url)).
3. Keep all Markdown headings and tables structured accurately.
4. Output ONLY the updated markdown document. Do NOT include pleasantries, notes, or explanations outside the document.`;

        const fullPrompt = `CURRENT FAILING DIMENSION:
Dimension: ${targetDefect.dimension}
Value: ${targetDefect.value}
Instruction: ${targetDefect.instruction}
${dampingPrompt}

DOCUMENT TO SURGICALLY EDIT:
${currentMd}`;

        const candidateRaw = await this.llmClient.complete(fullPrompt, fullSystemPrompt);
        candidateMd = candidateRaw.trim();
        if (candidateMd.startsWith("```markdown\n") && candidateMd.endsWith("\n```")) {
          candidateMd = candidateMd.slice(12, -4);
        }
      }

      // 4. Non-Neural AST Integrity Guard (Hardware-Style Interlock)
      this.logger(`[AST Guard] Running cryptographic and AST invariant checks...`);
      const astCheck = verifyAstIntegrity(baselineMd, candidateMd);
      
      if (!astCheck.valid) {
        this.logger(`🚨 [HARD ROLLBACK] Invariant violation detected! Edit discarded.`);
        for (const v of astCheck.violations) {
          this.logger(`   - ${v.detail}`);
        }
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
