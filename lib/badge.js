/**
 * Badge Generator for Measured Humanizer
 * Produces crisp SVG badges & Shields.io JSON endpoints
 */

const fs = require("fs");
const path = require("path");

function generateSvgBadge(score, pass = true, label = "human-grade") {
  const pct = Math.round(score * 100);
  const color = pass ? "#10b981" : "#ef4444";
  const statusText = pass ? `${pct}% passing` : `${pct}% robotic`;

  // Standard flat shield badge template
  return `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="20" role="img" aria-label="${label}: ${statusText}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="168" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="84" height="20" fill="#1e293b"/>
    <rect x="84" width="84" height="20" fill="${color}"/>
    <rect width="168" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="420" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${label}</text>
    <text x="420" y="140" transform="scale(.1)" fill="#fff">${label}</text>
    <text aria-hidden="true" x="1260" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${statusText}</text>
    <text x="1260" y="140" transform="scale(.1)" fill="#fff">${statusText}</text>
  </g>
</svg>`;
}

function writeBadgeFile(score, pass = true, outDir = null) {
  const dir = outDir || path.join(__dirname, "..", "badges");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const svg = generateSvgBadge(score, pass);
  fs.writeFileSync(path.join(dir, "human-grade.svg"), svg, "utf8");

  const jsonEndpoint = {
    schemaVersion: 1,
    label: "human-grade",
    message: `${Math.round(score * 100)}% ${pass ? "pass" : "fail"}`,
    color: pass ? "brightgreen" : "red",
    isError: !pass,
  };
  fs.writeFileSync(path.join(dir, "human-grade.json"), JSON.stringify(jsonEndpoint, null, 2), "utf8");
  return { svgPath: path.join(dir, "human-grade.svg"), jsonPath: path.join(dir, "human-grade.json") };
}

module.exports = { generateSvgBadge, writeBadgeFile };
