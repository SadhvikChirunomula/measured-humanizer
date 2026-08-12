# Stop Banning Words: Why Your AI "Humanizer" Doesn't Work

If you spend any time reading technical writing today, you've probably learned to spot the "AI tell." The prose is a little too *robust*. It *seamlessly leverages* too many paradigms. It *delves* into topics. 

Our collective response to this has been to build massive blocklists of "robot words." We instruct our agents to stop saying "moreover" and ban them from using the word "crucial." 

There's just one problem: **the lists don't work.**

When we built [Measured Humanizer](https://github.com/SadhvikChirunomula/measured-humanizer), an enterprise-grade AI writing calibrator, we decided to actually measure this statistically. We took 36 human-written technical documents (written before generative tooling was common) and 45 AI-written technical documents, and we ran the numbers.

Here is what those popular "tells" actually measured, expressed as AUC (Area Under the Curve, where 0.5 is a coin flip):

| Signal | Separation (AUC) | Verdict |
|---|---|---|
| Hedging words (*may, might, typically*) | 0.516 | **Useless** — Humans actually hedged *more* |
| Bridge phrases (*moreover, furthermore*) | 0.527 | **Useless** — Near-zero base rate in both classes |
| Promotional adjectives (*robust, seamless, leverage*) | 0.535 | **Useless** — No consistent direction |

Banning the word "may" accomplishes absolutely nothing. Humans used it *more* than the generated set did. 

## What Actually Separates Human from AI Writing?

The difference isn't lexical. It's structural, and it isn't subtle.

When we threw out the words and looked at the *shape* of the text, the real differences emerged:

| Dimension | Separation (AUC) | Human Average | AI Average |
|---|---|---|---|
| Paragraph length variance | **0.897** | 28.6 | 12.8 |
| First-person rate (per 1k words) | **0.889** | 8.18 | 0.00 |
| Sentence length variance | 0.720 | 10.3 | 7.7 |
| Concrete-specific density | 0.686 | 28.0 | 19.9 |
| Contraction rate | 0.663 | 10.2 | 7.9 |

**AI writes paragraphs of near-uniform length and almost never says "we."** Those two facts carry more statistical signal than every phrase list combined.

When a human writes, they mix short, punchy sentences with long, explanatory ones. They write a massive paragraph explaining a complex mechanism, followed by a one-sentence paragraph for emphasis. AI, by default, outputs a wall of perfectly homogenous text.

## Introducing Measured Humanizer

We built **Measured Humanizer** to fix this. It's an agent-agnostic skill and CLI tool that makes writing read as human-written by *measuring it*, not by pattern-matching a list of words someone decided sound like a robot.

Instead of calling out to a black-box LLM classifier, it ships a dependency-free Node scorer calibrated against our corpora. 

### The Correction Loop

"Make this sound more human" is a prompt that rarely terminates successfully. Measured Humanizer replaces that subjective prompt with a deterministic loop:

1. **Measure:** Point it at a draft. It strips away the code blocks and markdown, and measures the remaining prose across sixteen dimensions.
2. **Diagnose:** It returns the *single worst* dimension (e.g., "Paragraph length variance is too low").
3. **Fix & Repeat:** You (or your AI agent) fix that *one* thing. Re-measure. Repeat until it passes the composite score threshold.

By focusing on one dimension per pass, the loop converges. 

### Protecting Code Integrity
A more human-sounding article that dropped its sources or mangled its code blocks is a worse article. We built in a `--before` flag to ensure that an agent's "style improvements" don't quietly rewrite your shell snippets or drop citations. If a fenced code block changes, the check fails.

## Conclusion

If you want to stop sounding like a robot, stop worrying about whether you used the word "leverage." Start looking at the variance in your paragraph lengths. Start using the first person when you talk about your team's work. 

A document contorted to hit the numbers is not necessarily good writing—but a document that fails these structural checks will almost always feel distinctly artificial.

*Measured Humanizer is open-source (MIT). You can run it natively as a CLI tool, integrate it into CI/CD pipelines, or use it directly as a skill for Claude Code and other agents. Check out the [GitHub repository](https://github.com/SadhvikChirunomula/measured-humanizer).*
