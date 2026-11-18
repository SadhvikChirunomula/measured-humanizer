# Measured Humanizer - Community Launch & Distribution Kit

This kit contains ready-to-use launch drafts, forum templates, social posts, and directory submission entries to grow the reach and adoption of **Measured Humanizer**.

---

## 1. Hacker News (Show HN)

**Title:**
```text
Show HN: Measured Humanizer – A deterministic, statistical style gate for AI prose
```

**Link:**
```text
https://github.com/SadhvikChirunomula/measured-humanizer
```

**First Comment (post immediately after submitting):**
```markdown
Hi HN!

Most "humanizer" tools and prompt guides tell you to ban specific words ("delve", "seamless", "moreover"). When we calibrated actual documents—measuring 36 human-written technical docs against 45 AI-written technical docs—we found that banned word lists measured essentially at chance:
- Hedging words (may, might, typically): AUC 0.516 (humans actually hedged *more*)
- Bridge phrases (moreover, furthermore): AUC 0.527
- Promotional adjectives (robust, seamless): AUC 0.535

What actually separated human prose from AI prose was almost entirely structural:
- Paragraph length variance (AUC 0.897) — AI writes paragraphs of uniform length.
- First-person pronoun rate (AUC 0.889) — AI almost never writes "we".
- Sentence length standard deviation (AUC 0.720).
- Em-dash rate & contraction density.

We built Measured Humanizer as an open-source, deterministic, zero-dependency Node scoring gate. Instead of asking an LLM "does this sound human?", it scores prose statistically against fitted percentiles.

In an agent loop (Claude Code, Codex, Antigravity, or pre-commit), the gate isolates the single worst failing dimension and returns a concrete instruction for fixing only that dimension. You can also pass `--before original.md` to ensure the agent didn't hallucinate away code blocks or drop URLs in the name of "style improvements".

- Code & Derivation: https://github.com/SadhvikChirunomula/measured-humanizer
- Zero runtime dependencies (runs on Node 14+)
- Also ships with a standalone MCP server and pre-commit hook support.

Would love your feedback on the derivation, the AUC thresholds, and how it performs on your technical drafts!
```

---

## 2. Reddit

### Recommended Subreddits:
- `r/ClaudeAI`
- `r/LocalLLaMA`
- `r/ChatGPTCoding`
- `r/programming`

**Title:**
```text
Why "banned word lists" don't make AI writing human (and what actual statistical measurement showed)
```

**Body:**
```markdown
Whenever people discuss de-slopping AI text, the advice is usually: "remove 'delve', 'testament', and 'furthermore'".

We calibrated 36 human-written technical docs and 45 AI-generated technical docs to see if that advice holds up statistically using ROC-AUC (0.5 is random chance):

| Signal | AUC | What we found |
|---|---|---|
| Hedging ("may", "might") | 0.516 | Humans hedged *more* |
| Bridge phrases ("moreover") | 0.527 | Near-zero in both classes |
| Promotional adjectives ("robust") | 0.535 | No consistent direction |

What actually separated the two datasets was structural variance:
- **Paragraph length variance (AUC 0.897)**: Human stdev was 28.6 words; AI was 12.8 words. AI paragraphs are eerily uniform.
- **First-person rate (AUC 0.889)**: Humans used 8.18 / 1k words; AI averaged 0.00.
- **Sentence length variance (AUC 0.720)**: Human sentence lengths vary dramatically; AI sentence lengths cluster closely around a mean.

We packaged this into **Measured Humanizer**, a zero-dependency, open-source tool and agent skill:
https://github.com/SadhvikChirunomula/measured-humanizer

Features:
1. **Deterministic scoring**: Zero black-box LLM calls. Reproducible math.
2. **Prioritized fixes**: Tells your agent the single worst failing dimension per pass so it doesn't trade one flaw for another.
3. **Integrity protection (`--before`)**: Verifies code blocks and URLs weren't rewritten or deleted during editing.
4. **Agent & CLI ready**: Runs via `npx measured-humanizer`, GitHub Actions, Claude Code skill, and MCP server.

Let me know what you think of the calibration derivation!
```

---

## 3. X (Twitter) Launch Thread

**Post 1:**
> Banning "delve", "seamless", and "moreover" doesn't make AI writing read like human prose.
>
> We measured 36 human vs. 45 AI technical docs using AUC. Word lists measured around 0.51 (pure coin-flip).
>
> Here is what actually separates human writing from AI 🧵👇

**Post 2 (Image: screenshot of AUC table from README):**
> What actually creates the "AI feel" isn't vocabulary—it's structural uniformity:
>
> 1. Paragraph length variance (AUC 0.897): AI paragraphs are mechanically uniform.
> 2. First-person density (AUC 0.889): AI almost never says "we".
> 3. Sentence variance (AUC 0.720): Humans swing between 4-word punchlines and 35-word explanations.

**Post 3 (Image: docs/loop.svg or CLI screenshot):**
> Asking an agent "make this sound human" never converges.
>
> We open-sourced **Measured Humanizer**: a deterministic, zero-dependency statistical gate for technical writing.
>
> It returns a composite score and the single worst failing dimension. Fix one thing. Re-measure. Terminate cleanly.

**Post 4:**
> It also features an integrity check (`--before`): if an agent edits your documentation, it confirms no code blocks were altered and no citations were dropped.
>
> Run it via:
> 📦 `npx measured-humanizer doc.md`
> 🤖 GitHub Action in CI
> 🔌 Claude Code Skill / MCP Server
>
> GitHub: https://github.com/SadhvikChirunomula/measured-humanizer

---

## 4. Ecosystem Submission Directory Checklists

- [ ] **Awesome Claude**: Open a PR to `hesreallyhim/awesome-claude` and `travisvn/awesome-claude-prompts`.
- [ ] **Awesome LLM / DevTools**: Submit to `steven2358/awesome-generative-ai` and `underfissure/awesome-prompt-engineering`.
- [ ] **Model Context Protocol Directory**: Submit `measured-humanizer-mcp` to `modelcontextprotocol/servers`.
- [ ] **Daily.dev / Dev.to**: Publish the derivation case study with code snippets.
