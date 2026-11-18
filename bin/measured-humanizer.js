#!/usr/bin/env node
const path = require("path");

const gatePath = path.join(__dirname, "..", "skills", "measured-humanizer", "gate", "style_gate.js");
const { runCli } = require(gatePath);
runCli();
