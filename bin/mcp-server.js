#!/usr/bin/env node
/**
 * Measured Humanizer - Model Context Protocol (MCP) Server
 * Lightweight, zero-dependency stdio JSON-RPC MCP server.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const gatePath = path.join(__dirname, "..", "skills", "measured-humanizer", "gate", "style_gate.js");
const threshPath = path.join(__dirname, "..", "skills", "measured-humanizer", "gate", "thresholds.json");

const { gate, metrics, integrity } = require(gatePath);
const defaultThresholds = JSON.parse(fs.readFileSync(threshPath, "utf8"));

const SERVER_NAME = "measured-humanizer-mcp";
const SERVER_VERSION = "1.0.0";
const PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "measure_prose",
    description: "Evaluates markdown prose against the calibrated Measured Humanizer style gate. Scores structural variance (sentence and paragraph length distributions, first-person rate, contractions, discourse markers) and returns a pass/fail verdict, composite score, and the single worst failing dimension with instructions to fix it.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Markdown text content to evaluate. Either 'text' or 'filePath' must be provided."
        },
        filePath: {
          type: "string",
          description: "Absolute or relative file path to the markdown file to evaluate."
        },
        before: {
          type: "string",
          description: "Original text or file path before edits, to verify code block and link integrity."
        },
        noZoning: {
          type: "boolean",
          description: "Disable H2/H3 question heading zoning checks (useful for READMEs, emails, or design docs). Default false."
        }
      }
    }
  },
  {
    name: "raw_metrics",
    description: "Computes raw statistical metrics across markdown prose (paragraph variance, sentence variance, pronoun density, concrete nouns, contractions, promo phrases) without applying gate thresholds.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Markdown text content to evaluate."
        },
        filePath: {
          type: "string",
          description: "File path to the markdown document."
        }
      }
    }
  }
];

function resolveContent(args) {
  if (args.text !== undefined && args.text !== null) {
    return args.text;
  }
  if (args.filePath) {
    return fs.readFileSync(path.resolve(process.cwd(), args.filePath), "utf8");
  }
  throw new Error("Either 'text' or 'filePath' must be provided.");
}

function resolveBefore(before) {
  if (!before) return null;
  if (fs.existsSync(before)) {
    try {
      return fs.readFileSync(before, "utf8");
    } catch (_) {
      return before;
    }
  }
  return before;
}

function handleToolCall(name, args) {
  if (name === "measure_prose") {
    const md = resolveContent(args);
    const beforeMd = resolveBefore(args.before);
    const options = { zoning: !args.noZoning };
    const result = gate(md, defaultThresholds, beforeMd, options);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  if (name === "raw_metrics") {
    const md = resolveContent(args);
    const result = metrics(md);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function sendResponse(id, result, error = null) {
  const response = {
    jsonrpc: "2.0",
    id
  };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  process.stdout.write(JSON.stringify(response) + "\n");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (err) {
    sendResponse(null, null, { code: -32700, message: "Parse error" });
    return;
  }

  const { id, method, params } = message;

  // Notifications (no id)
  if (id === undefined || id === null) {
    return;
  }

  switch (method) {
    case "initialize":
      sendResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        }
      });
      break;

    case "tools/list":
      sendResponse(id, {
        tools: TOOLS
      });
      break;

    case "tools/call":
      try {
        const toolResult = handleToolCall(params.name, params.arguments || {});
        sendResponse(id, toolResult);
      } catch (err) {
        sendResponse(id, {
          content: [
            {
              type: "text",
              text: `Error executing tool '${params.name}': ${err.message}`
            }
          ],
          isError: true
        });
      }
      break;

    case "ping":
      sendResponse(id, {});
      break;

    default:
      sendResponse(id, null, { code: -32601, message: `Method not found: ${method}` });
      break;
  }
});
