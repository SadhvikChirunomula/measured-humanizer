# Measured Humanizer for VS Code & Cursor

Deterministic style linting and surgical paragraph repair for Markdown technical writing right in your editor. Think **ESLint for human-written prose**.

![VS Code Diagnostics Preview](https://img.shields.io/badge/VS%20Code-Ready-blue.svg)

---

## ✨ Features

- **Inline Squiggly Diagnostics**: Automatically highlights robotic paragraphs, artificial parallelism, and sterile rhythm in your Markdown files.
- **Adaptive Domain Profiles**: Switch profiles (`engineering`, `executive`, `marketing`, `academic`) directly from the command palette.
- **Quick-Fix Code Actions**: Click the lightbulb (`Cmd+.` / `Alt+Enter`) on any highlighted paragraph to surgically repair the defect.
- **AST Protection Guard**: Never worry about code blocks or source links getting corrupted during a rewrite.
- **Status Bar Integration**: Displays the real-time composite human-likeness score in the bottom right status bar.

---

## 🛠️ Installation & Packaging

### Local Installation
```bash
cd extensions/vscode
npx @vscode/vsce package
code --install-extension measured-humanizer-vscode-1.0.0.vsix
```

### Configuration Options
In your VS Code `settings.json`:
```json
{
  "measuredHumanizer.profile": "engineering",
  "measuredHumanizer.liveDiagnostics": true,
  "measuredHumanizer.provider": "ollama"
}
```
