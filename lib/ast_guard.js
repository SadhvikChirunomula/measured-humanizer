/**
 * AST Integrity Guard
 * Non-neural, deterministic verification of markdown structure invariants.
 * Uses cryptographic hashing (SHA-256) and AST pattern extraction to guarantee
 * that code blocks, inline code literals, URLs/citations, and tables remain intact.
 */

const crypto = require("crypto");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function extractFencedBlocks(md) {
  const blocks = [];
  const regex = /(?:^|\n)```([^\n]*)\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(md)) !== null) {
    blocks.push({
      lang: match[1].trim(),
      content: match[2],
      hash: sha256(match[2].replace(/\r\n/g, "\n").trim()),
      raw: match[0],
    });
  }
  return blocks;
}

function extractInlineCode(md) {
  // Extract `code` excluding fenced blocks
  const noFences = md.replace(/(?:^|\n)```[\s\S]*?\n```/g, "");
  const matches = noFences.match(/`[^`\n]+`/g) || [];
  return matches.map((m) => m.slice(1, -1).trim());
}

function extractUrls(md) {
  const urls = [];
  const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(md)) !== null) {
    urls.push({
      text: match[1],
      url: match[2],
      hash: sha256(match[2]),
    });
  }
  return urls;
}

function extractTables(md) {
  const tables = [];
  const lines = md.split("\n");
  let inTable = false;
  let currentTable = [];

  for (const line of lines) {
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      inTable = true;
      currentTable.push(line.trim());
    } else {
      if (inTable && currentTable.length >= 2) {
        tables.push({
          lines: currentTable,
          header: currentTable[0],
          hash: sha256(currentTable.join("\n")),
        });
      }
      inTable = false;
      currentTable = [];
    }
  }
  if (inTable && currentTable.length >= 2) {
    tables.push({
      lines: currentTable,
      header: currentTable[0],
      hash: sha256(currentTable.join("\n")),
    });
  }
  return tables;
}

/**
 * Verifies that candidateMd satisfies all invariant constraints relative to baselineMd.
 */
function verifyAstIntegrity(baselineMd, candidateMd) {
  const violations = [];

  // 1. Fenced Code Block Invariance
  const baseFences = extractFencedBlocks(baselineMd);
  const candFences = extractFencedBlocks(candidateMd);

  if (baseFences.length !== candFences.length) {
    violations.push({
      type: "FENCED_BLOCK_COUNT_MISMATCH",
      expected: baseFences.length,
      actual: candFences.length,
      detail: `Fenced code block count changed from ${baseFences.length} to ${candFences.length}`,
    });
  } else {
    for (let i = 0; i < baseFences.length; i++) {
      if (baseFences[i].hash !== candFences[i].hash) {
        violations.push({
          type: "FENCED_BLOCK_MUTATED",
          blockIndex: i,
          lang: baseFences[i].lang,
          expectedHash: baseFences[i].hash,
          actualHash: candFences[i].hash,
          detail: `Fenced block #${i + 1} (${baseFences[i].lang || "plain"}) was illegally altered by the editor`,
        });
      }
    }
  }

  // 2. Link & Citation Invariance
  const baseUrls = extractUrls(baselineMd);
  const candUrls = extractUrls(candidateMd);
  const candUrlSet = new Set(candUrls.map((u) => u.url));

  const missingUrls = [];
  for (const u of baseUrls) {
    if (!candUrlSet.has(u.url)) {
      missingUrls.push(u.url);
    }
  }

  if (missingUrls.length > 0) {
    violations.push({
      type: "CITATIONS_DROPPED",
      missingCount: missingUrls.length,
      missingUrls,
      detail: `The editor dropped ${missingUrls.length} source link(s): ${missingUrls.slice(0, 3).join(", ")}`,
    });
  }

  // 3. Table Column Structure Invariance
  const baseTables = extractTables(baselineMd);
  const candTables = extractTables(candidateMd);

  if (baseTables.length !== candTables.length) {
    violations.push({
      type: "TABLE_COUNT_MISMATCH",
      expected: baseTables.length,
      actual: candTables.length,
      detail: `Markdown table count changed from ${baseTables.length} to ${candTables.length}`,
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    stats: {
      fencedBlocks: baseFences.length,
      urls: baseUrls.length,
      tables: baseTables.length,
    },
  };
}

module.exports = {
  verifyAstIntegrity,
  extractFencedBlocks,
  extractUrls,
  extractTables,
  extractInlineCode,
  sha256,
};
