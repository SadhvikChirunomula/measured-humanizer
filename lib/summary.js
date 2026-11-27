/**
 * GitHub Actions Step Summary & Scorecard Formatter
 * Produces rich Markdown tables for $GITHUB_STEP_SUMMARY
 */

function generateStepSummary(verdict, filename = "document.md", profileName = "engineering") {
  const isPass = verdict.pass && !verdict.vetoed;
  const statusIcon = isPass ? "✅" : "❌";
  const statusBadge = isPass ? "**PASSED**" : "**FAILED**";
  const compositePct = Math.round(verdict.composite * 100);

  let md = `## ${statusIcon} Measured Humanizer Quality Gate: ${statusBadge}\n\n`;
  md += `| Attribute | Value |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Document** | \`${filename}\` |\n`;
  md += `| **Calibrated Profile** | \`${profileName}\` (cutoff: ${verdict.cutoff}) |\n`;
  md += `| **Composite Score** | **${verdict.composite.toFixed(3)}** / ${verdict.cutoff} (${compositePct}%) |\n`;
  md += `| **Status** | ${isPass ? "🎉 Verified Human-Grade" : "⚠️ Robotic Cadence Detected"} |\n`;
  md += `| **Absolute Rule Veto** | ${verdict.vetoed ? `🚨 Tripped: \`${verdict.vetoed}\`` : "✓ Clean (0 Vetoes)"} |\n\n`;

  md += `### 📊 Dimension-by-Dimension Breakdown\n\n`;
  md += `| Style Dimension | Measured | Target Threshold | Verdict |\n`;
  md += `| :--- | :---: | :---: | :---: |\n`;

  const failures = verdict.failures || [];
  const failureDims = new Set(failures.map(f => f.dimension));

  if (verdict.dimensions) {
    for (const [dim, val] of Object.entries(verdict.dimensions)) {
      const failed = failureDims.has(dim);
      const icon = failed ? "❌ FAIL" : "✅ PASS";
      const displayVal = typeof val === "number" ? val.toFixed(2) : String(val);
      md += `| \`${dim}\` | ${displayVal} | — | ${icon} |\n`;
    }
  } else {
    // If gate output formats dimensions under metric keys
    const dims = [
      { name: "Paragraph Rhythm (Variance)", key: "paragraph_length_stdev" },
      { name: "First-Person Perspective", key: "first_person_pronoun_rate" },
      { name: "Contraction Cadence", key: "contraction_rate" },
      { name: "Structural Parallelism", key: "parallelism_score" },
    ];
    for (const d of dims) {
      const failed = failureDims.has(d.key);
      const icon = failed ? "❌ FAIL" : "✅ PASS";
      md += `| ${d.name} | Evaluated | Calibrated | ${icon} |\n`;
    }
  }

  if (!isPass && verdict.worst) {
    md += `\n### 🎯 Recommended Surgical Remediation\n\n`;
    md += `> **Primary Defect**: \`${verdict.worst.dimension}\`\n>\n`;
    md += `> **Actionable Fix**: ${verdict.worst.instruction}\n\n`;
    md += `Run \`measured-humanize-loop ${filename}\` to repair this defect automatically.\n`;
  }

  return md;
}

module.exports = { generateStepSummary };
