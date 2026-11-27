# 100% Local Quantized SLM Worker

Run the closed-loop autonomous humanizer completely offline on your local machine with **zero API costs**, **zero rate limits**, and **zero external network telemetry**.

Small Language Models (SLMs) such as **Qwen 2.5 (3B)** or **Llama 3.2 (3B)** running under 4-bit / 8-bit quantization excel at the surgical paragraph repair task because Measured Humanizer specifies exact structural defect constraints rather than asking the model to rewrite the entire document.

---

## 🚀 Quickstart with Ollama

### 1. Pull base weights and create the worker
```bash
# Option A: Fast & lightweight (recommended)
ollama pull qwen2.5:3b
ollama create measured-slm -f models/Modelfile.qwen2.5-humanizer

# Option B: Llama 3.2 variant
ollama pull llama3.2:3b
ollama create measured-slm-llama -f models/Modelfile.llama3.2-humanizer
```

### 2. Run the Autonomous Loop Locally
```bash
measured-humanize-loop \
  --provider ollama \
  --model measured-slm \
  --profile engineering \
  draft.md
```

### 3. Environment Variables
You can also set environment variables in your `.env` or shell:
```bash
export LLM_PROVIDER="ollama"
export LLM_ENDPOINT="http://127.0.0.1:11434/v1/chat/completions"
measured-humanize-loop draft.md
```

---

## 🔒 Enterprise Air-Gapped Deployment (vLLM / LocalAI / LM Studio)
Any OpenAI-compatible local server can be connected via `--endpoint`:

```bash
# Example with vLLM
python3 -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-3B-Instruct --port 8000

measured-humanize-loop \
  --provider openai \
  --endpoint http://127.0.0.1:8000/v1/chat/completions \
  --model Qwen/Qwen2.5-3B-Instruct \
  draft.md
```
