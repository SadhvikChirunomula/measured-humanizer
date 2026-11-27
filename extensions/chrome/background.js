/**
 * Measured Humanizer - Chrome Extension Background Service Worker
 * Dispatches LLM completions without page CORS restrictions.
 */

const DEFAULT_SETTINGS = {
  provider: "ollama",
  model: "measured-slm",
  endpoint: "http://127.0.0.1:11434/v1/chat/completions",
  apiKey: "",
  defaultProfile: "engineering",
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (items) => {
    const init = Object.assign({}, DEFAULT_SETTINGS, items);
    chrome.storage.sync.set(init);
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "HUMANIZE_REQUEST") {
    handleHumanizeRequest(request)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});

async function handleHumanizeRequest(req) {
  const settings = await new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, resolve);
  });

  const { text, profile, defect } = req;
  const instruction = defect ? defect.instruction : "Improve burstiness, sentence variance, and natural cadence.";

  const systemPrompt = `You are an expert technical editor.
Your job is to rewrite the provided text to resolve a specific structural style flaw while preserving facts, technical terminology, and meaning.
CRITICAL RULES:
1. Output ONLY the replacement text. Never add preambles, notes, quotes, or markdown wrappers.
2. Fix the specific flaw requested: "${instruction}".
3. Keep the authentic human practitioner tone.`;

  const userPrompt = `ORIGINAL TEXT TO HUMANIZE:
${text}

FLAW TO FIX:
${instruction}`;

  // 1. Ollama or OpenAI-compatible endpoint
  if (settings.provider === "ollama" || settings.provider === "openai") {
    try {
      const url = settings.endpoint || "http://127.0.0.1:11434/v1/chat/completions";
      const headers = { "Content-Type": "application/json" };
      if (settings.apiKey) headers["Authorization"] = `Bearer ${settings.apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: settings.model || "measured-slm",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        throw new Error(`LLM API returned status ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (content) {
        return { success: true, resultText: content.trim() };
      }
    } catch (err) {
      console.warn("Direct LLM request failed, falling back to local patch:", err.message);
    }
  }

  // 2. Anthropic API
  if (settings.provider === "anthropic" && settings.apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: settings.model || "claude-3-5-sonnet-20241022",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.content && data.content[0] && data.content[0].text;
        if (content) return { success: true, resultText: content.trim() };
      }
    } catch (err) {
      console.warn("Anthropic API request failed:", err.message);
    }
  }

  // 3. Fallback to client-side rule patcher
  return { success: false, fallback: true };
}
