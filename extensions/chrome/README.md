# Measured Humanizer Chrome Extension

Deterministic style gate & real-time humanizer for every text box on the web. Works inside **Gmail, Google Docs, Notion, LinkedIn, Reddit, Twitter / X, ChatGPT, Substack, Medium**, and any web form. Think **Grammarly / QuillBot**, but deterministic, zero fluff, and powered by AST code armor.

---

## ✨ Features

- **Floating Sniff-Test Badge**: As you type in any textarea, input, or contenteditable editor, a sleek floating badge displays your real-time Human-Likeness score (e.g. `⚡ 64% [Robotic]` or `⚡ 98% [Human-Grade]`).
- **One-Click Surgical Repair**: Click the badge to open the inspection card and press **"⚡ Humanize"** to repair defects in-place without leaving your tab.
- **Adaptive Domain Profiles**: Switch profiles on the fly:
  - 🛠️ **Engineering** (Code blocks, technical docs, RFCs)
  - 💼 **Executive** (Briefs, stakeholder updates, concrete density)
  - 📣 **Marketing** (Punchy landing copy, high contractions)
  - 🎓 **Academic** (Formal research, passive restraint)
- **Local & Private (Ollama Support)**: Connects to your local Ollama instance (`measured-slm`, `qwen2.5:3b`, or `llama3.2:3b`) for 100% free, private, offline execution. Also supports OpenAI and Anthropic API keys.
- **Instant Undo**: Accidentally humanized or prefer your original draft? Click "Undo" to restore your exact original text.
- **Shadow DOM Isolation**: Completely isolated from host page CSS—never breaks or inherits website styles.

---

## 🛠️ Installation (Developer Mode)

1. Open Google Chrome (or Brave, Edge, Opera, Arc).
2. Navigate to `chrome://extensions`.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the `extensions/chrome` directory from this repository.
6. The Measured Humanizer lightning badge `⚡` will appear in your browser extensions toolbar!

---

## ⚙️ Configuration

Click the extension icon in your Chrome toolbar to open settings:
* **Default Profile**: Choose your preferred domain profile.
* **Provider**:
  * `Local Ollama`: Connect to `http://127.0.0.1:11434/v1/chat/completions` (requires zero API keys).
  * `OpenAI`: Use GPT-4o with your API key.
  * `Anthropic`: Use Claude 3.5 Sonnet with your API key.
  * `Offline Heuristic Patcher`: Fast local regex & statistical repair without any external models.
