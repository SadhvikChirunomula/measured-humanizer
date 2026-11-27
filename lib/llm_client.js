/**
 * Pluggable LLM Client Adapter
 * Supports OpenAI, Anthropic, Ollama / Local vLLM, or Custom API hooks.
 * Defaults to standard HTTP/HTTPS requests with zero external npm dependencies.
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

class LLMClient {
  constructor(options = {}) {
    this.provider = options.provider || process.env.LLM_PROVIDER || "mock";
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";
    this.model = options.model || (this.provider === "anthropic" ? "claude-3-5-sonnet-20241022" : "gpt-4o");
    this.endpoint = options.endpoint || process.env.LLM_ENDPOINT || "";
    this.mockHandler = options.mockHandler || null;
  }

  async complete(prompt, systemPrompt = "") {
    if (this.provider === "mock" && this.mockHandler) {
      return this.mockHandler(prompt, systemPrompt);
    }

    if (this.provider === "anthropic") {
      return this._callAnthropic(prompt, systemPrompt);
    }

    if (this.provider === "openai" || this.provider === "ollama") {
      return this._callOpenAICompatible(prompt, systemPrompt);
    }

    throw new Error(`Unsupported LLM provider: ${this.provider}. Set LLM_PROVIDER to anthropic, openai, or ollama.`);
  }

  _callAnthropic(prompt, systemPrompt) {
    const payload = JSON.stringify({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    return this._postRequest("https://api.anthropic.com/v1/messages", {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    }, payload, (data) => data.content[0].text);
  }

  _callOpenAICompatible(prompt, systemPrompt) {
    const url = this.endpoint || "https://api.openai.com/v1/chat/completions";
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const payload = JSON.stringify({
      model: this.model,
      messages,
      temperature: 0.3,
    });

    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    return this._postRequest(url, headers, payload, (data) => data.choices[0].message.content);
  }

  _postRequest(urlString, headers, body, extractFn) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlString);
      const isHttps = parsedUrl.protocol === "https:";
      const client = isHttps ? https : http;

      const req = client.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        headers: Object.assign({}, headers, { "Content-Length": Buffer.byteLength(body) }),
      }, (res) => {
        let respData = "";
        res.on("data", (chunk) => { respData += chunk; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(respData);
              resolve(extractFn(json));
            } catch (err) {
              reject(new Error(`Failed to parse LLM response JSON: ${err.message}`));
            }
          } else {
            reject(new Error(`LLM API error [${res.statusCode}]: ${respData}`));
          }
        });
      });

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}

module.exports = { LLMClient };
