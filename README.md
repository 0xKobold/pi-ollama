# Pi Ollama Extension

Ollama integration for [pi-coding-agent](https://github.com/badlogic/pi-mono) with accurate model details from `/api/show`.

## Changelog

### v0.5.0

- **Fix**: DeepSeek models now return correct context lengths — `deepseek-v4` → 1M tokens, other deepseek → 163,840 tokens (was 4,096). Closes [#4](https://github.com/0xKobold/pi-ollama/issues/4).
- **Fix**: Default context fallback raised from 4,096 → 131,072 (128k). Per [Ollama docs](https://docs.ollama.com/context-length), cloud models default to their maximum context; 128k is a conservative floor for unknowns.
- **Fix**: `hasReasoningCapability()` no longer flags `instruct`, `chat`, or `code`/`coder` models as reasoning. Only models with actual thinking capability (DeepSeek, R1, QwQ, GPT-OSS, Phi) or a `thinking`/`reason` capability from `/api/show` are marked as reasoning. See [Ollama thinking docs](https://docs.ollama.com/capabilities/thinking).
- **Fix**: `createModel()` now sets `maxTokens` to `min(contextWindow, 16384)` instead of hardcoded 8192. `chat()`/`chatStream()` no longer send `max_tokens: 4096` by default — omitted unless explicitly set.
- **Fix**: Cloud model deduplication now properly strips `:cloud` suffix before comparing model names.
- **Fix**: `loadConfigFromSettingsFiles()` now uses async dynamic `import()` instead of `require()`, fixing ESM compatibility.
- **New**: `hasReasoningCapability()` accepts optional `modelInfo` parameter and checks `capabilities` array for `thinking`/`reason`.
- **New**: Error classification — `chat()` and `chatStream()` now throw typed errors: `OllamaAuthError` (401/403), `OllamaRateLimitError` (429), `OllamaModelError` (400/404), `OllamaServerError` (500/502).
- **New**: Request timeout — `chat()` and `chatStream()` now apply a 120s timeout via `AbortController`.
- **New**: Exported constants `DEFAULT_CONTEXT_LENGTH` (131072), `DEFAULT_MAX_TOKENS` (8192), `DEFAULT_REQUEST_TIMEOUT_MS` (120000).
- **New**: `stripProviderPrefix()` now exported and tested.
- **Docs**: Comprehensive JSDoc comments referencing [Ollama API docs](https://docs.ollama.com/).
- **Docs**: README updated with all context length tables, error types, and API reference.

### v0.4.1

- **Fix**: Cloud models now correctly use `/v1` endpoint. Previously, `ollama-cloud` was registered with `baseUrl: "https://ollama.com"`, causing pi to hit `https://ollama.com/chat/completions` (HTML homepage) instead of `https://ollama.com/v1/chat/completions`.
- **Fix**: Trailing slashes in `cloudUrl` config are now properly stripped before appending `/v1`.

## Installation

```bash
# Via pi CLI
pi install npm:@0xkobold/pi-ollama

# Or in pi-config.ts
{
  extensions: [
    'npm:@0xkobold/pi-ollama'
  ]
}

# Or temporary (testing)
pi -e npm:@0xkobold/pi-ollama
```

## Features

- 🦙 **Local Ollama** — Connect to localhost:11434
- ☁️ **Ollama Cloud** — Use ollama.com with API key
- 📊 **Accurate Details** — Uses `/api/show` for real context length
- 👁️ **Vision Detection** — Detects vision from `capabilities` array
- 🧠 **Reasoning Detection** — Detects thinking models from `capabilities` and name patterns
- 🔍 **Model Info** — Query specific model parameters
- 🛡️ **Error Classification** — Typed errors for auth, rate limits, model errors, server errors
- ⏱️ **Request Timeouts** — 120s default timeout on all HTTP calls

## Commands

| Command | Description |
|---------|-------------|
| `/ollama-status` | Check connection status |
| `/ollama-models` | List models with context length |
| `/ollama-info MODEL` | Show model details from `/api/show` |
| `/ollama status\|info\|models` | Shortcuts |

## How It Works

The extension uses Ollama's `/api/show` endpoint to get accurate model information:

```bash
curl http://localhost:11434/api/show -d '{
  "model": "gemma3",
  "verbose": true
}'
```

Response includes (per [Ollama docs](https://docs.ollama.com/api-reference/show-model-details)):
- `model_info.<arch>.context_length` — Accurate context window
- `capabilities` — `["completion", "vision", "thinking"]`
- `details.parameter_size` — "4.3B", "70B", etc.
- `details.family` — "gemma3", "llama", etc.

## Context Length Resolution

Context length is resolved in this order:

1. **`model_info.*.context_length`** — From `/api/show` (most accurate)
2. **Top-level keys** — `context_length`, `max_position_embeddings`, `max_sequence_length`, `n_ctx`
3. **Parameter-size heuristic** — Small models → smaller context
4. **Name-based lookup** — For cloud models without `/api/show`
5. **Default fallback** — 131,072 (128k tokens)

### Name-Based Context Length Table

| Model Family | Context Length | Source |
|-------------|---------------|--------|
| `deepseek-v4` | 1,048,576 (1M) | [Ollama library](https://ollama.com/library/deepseek-v4-flash) |
| `kimi` | 262,144 (256k) | [Ollama library](https://ollama.com/library/kimi-k2.5) |
| `qwen3` | 262,144 (256k) | [Ollama library](https://ollama.com/library/qwen3) |
| `minimax` | 204,800 (200k) | [Ollama library](https://ollama.com/library/minimax-m2.5) |
| `glm` | 202,752 (~198k) | [Ollama library](https://ollama.com/library/glm-4) |
| `llama3.1/3.2/3.3` | 128,000 (128k) | [Ollama library](https://ollama.com/library/llama3.1) |
| `deepseek` (non-v4) | 163,840 (160k) | [Ollama library](https://ollama.com/library/deepseek-r1) |
| `gpt-oss` | 128,000 (128k) | [Ollama library](https://ollama.com/library/gpt-oss) |
| `qwen`/`qwen2.5` | 32,768 (32k) | [Ollama library](https://ollama.com/library/qwen2.5) |
| `mistral`/`mixtral` | 32,768 (32k) | [Ollama library](https://ollama.com/library/mistral) |
| `llama3` | 8,192 | [Ollama library](https://ollama.com/library/llama3) |
| **Unknown** | **131,072 (128k)** | Conservative default per [Ollama context docs](https://docs.ollama.com/context-length) |

## Reasoning Capability Detection

Per [Ollama thinking docs](https://docs.ollama.com/capabilities/thinking), reasoning/thinking is detected by:

1. **`capabilities` array** from `/api/show` — if it includes `"thinking"` or `"reason"`
2. **Name-based heuristic** (for cloud models):
   - ✅ DeepSeek models (have think mode)
   - ✅ `r1` models (word boundary match)
   - ✅ QwQ, GPT-OSS, Phi
   - ✅ Models containing "reason"
   - ❌ `instruct`, `chat`, `code`/`coder` — these are format tags, NOT reasoning

## Error Handling

All HTTP calls classify errors into typed classes:

| Class | Status Codes | Meaning |
|-------|-------------|---------|
| `OllamaAuthError` | 401, 403 | Invalid API key |
| `OllamaRateLimitError` | 429 | Rate limit exceeded |
| `OllamaModelError` | 400, 404 | Bad request or model not found |
| `OllamaServerError` | 500, 502 | Server/gateway error |
| `OllamaError` | Other | Catch-all |

Per [Ollama error docs](https://docs.ollama.com/api/errors).

## Configuration

Configuration is loaded with the following precedence (highest to lowest):

1. **Environment variables** (override everything)
2. **`pi.settings`** (runtime API, when available)
3. **`.pi/settings.json`** (project-local settings)
4. **`~/.pi/agent/settings.json`** (global user settings)

### Environment Variables

```bash
export OLLAMA_HOST="http://localhost:11434"       # Local base URL
export OLLAMA_HOST_CLOUD="https://ollama.com"     # Cloud base URL
export OLLAMA_API_KEY="your-api-key"              # Cloud API key
```

### Settings File

Add to your global settings (`~/.pi/agent/settings.json`):

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "cloudUrl": "https://ollama.com",
    "apiKey": "your-ollama-cloud-api-key"
  }
}
```

Per [Ollama cloud docs](https://docs.ollama.com/cloud).

## API Reference

```typescript
import {
  fetchModelDetails,
  getContextLength,
  hasVisionCapability,
  hasReasoningCapability,
  createClients,
  classifyHttpError,
  OllamaError,
  OllamaAuthError,
  OllamaRateLimitError,
  OllamaModelError,
  OllamaServerError,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_MAX_TOKENS,
} from '@0xkobold/pi-ollama/shared';

// Get model details from local Ollama
const details = await fetchModelDetails(client, 'gemma3');

// Extract context length (with name-based fallback)
const ctx = getContextLength(details, 'gemma3');  // 131072

// Check capabilities
const hasVision = hasVisionCapability(details);           // true/false
const hasReasoning = hasReasoningCapability('deepseek-r1', details);  // true

// Classify HTTP errors
try {
  await chat(client, { model: 'gemma3', messages: [...] });
} catch (err) {
  if (err instanceof OllamaRateLimitError) {
    // Handle rate limit
  } else if (err instanceof OllamaAuthError) {
    // Handle auth failure
  }
}
```

## License

MIT © 0xKobold