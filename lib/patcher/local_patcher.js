/**
 * Local Patch Generator & Splice Engine
 * Isolates and surgically replaces ONLY the defective paragraph or section,
 * preserving all surrounding document context and eliminating non-local side effects.
 */

const { extractFencedBlocks } = require("../ast_guard");

/**
 * Splits document into structural units (headings, fenced blocks, paragraphs)
 * while preserving exact delimiters.
 */
function tokenizeDocument(md) {
  const tokens = [];
  const lines = md.split("\n");
  let buffer = [];
  let inFence = false;
  let fenceDelimiter = "";

  function flushParagraph() {
    if (buffer.length > 0) {
      tokens.push({
        type: "paragraph",
        raw: buffer.join("\n"),
      });
      buffer = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check fenced code block boundaries
    if (line.trim().startsWith("```")) {
      if (!inFence) {
        flushParagraph();
        inFence = true;
        fenceDelimiter = line;
        buffer = [line];
      } else {
        buffer.push(line);
        tokens.push({
          type: "fenced_block",
          raw: buffer.join("\n"),
        });
        buffer = [];
        inFence = false;
        fenceDelimiter = "";
      }
      continue;
    }

    if (inFence) {
      buffer.push(line);
      continue;
    }

    // Check Headings
    if (/^#{1,6}\s+/.test(line.trim())) {
      flushParagraph();
      tokens.push({
        type: "heading",
        raw: line,
      });
      continue;
    }

    // Check blank lines (paragraph separators)
    if (line.trim() === "") {
      flushParagraph();
      tokens.push({
        type: "blank_line",
        raw: line,
      });
      continue;
    }

    buffer.push(line);
  }

  flushParagraph();
  return tokens;
}

/**
 * Locates the specific paragraph token index responsible for a given defect.
 */
function locateDefectTokenIndex(tokens, defect) {
  const { dimension } = defect;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== "paragraph") continue;

    // Parallelism check: "not X, but Y"
    if (dimension === "parallelism") {
      if (/\b(?:not (?:just |merely |simply )?[\w\s]{2,30}, but|isn't (?:just |merely )?[\w\s]{2,30}, it's|it's not [\w\s]{2,30}, it's)\b/i.test(token.raw)) {
        return i;
      }
    }

    // Discourse marker check
    if (dimension === "discourse_markers") {
      if (/\b(?:the (?:real )?problem is|the tradeoff is|the catch is|the mistake is|the point is|the fix is)\b/i.test(token.raw)) {
        return i;
      }
    }

    // Filler check: "is that"
    if (dimension === "is_that_filler") {
      if (/\b(?:problem is that|means is that|reason is that|thing is that)\b/i.test(token.raw)) {
        return i;
      }
    }
  }

  // Fallback for document-wide metrics (first_person_rate, para_stdev, sent_stdev):
  // Select first eligible non-empty paragraph
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === "paragraph" && tokens[i].raw.trim().length > 30) {
      return i;
    }
  }

  return 0;
}

/**
 * Splices a rewritten paragraph token back into the tokenized document and reconstructs markdown.
 */
function spliceToken(tokens, index, newRaw) {
  const newTokens = tokens.map((t, i) => {
    if (i === index) {
      return Object.assign({}, t, { raw: newRaw.trim() });
    }
    return t;
  });
  return newTokens.map((t) => t.raw).join("\n");
}

module.exports = {
  tokenizeDocument,
  locateDefectTokenIndex,
  spliceToken,
};
