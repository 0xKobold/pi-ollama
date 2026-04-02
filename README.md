# Pi Ollama Extension

Ollama integration for [pi-coding-agent](https://github.com/badlogic/pi-mono) with accurate model details from `/api/show`.

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

- 🦙 **Local Ollama** - Connect to localhost:11434
- ☁️ **Ollama Cloud** - Use ollama.com with API key
- 📊 **Accurate Details** - Uses `/api/show` for real context length
- 👁️ **Vision Detection** - Detects vision from capabilities array
- 🧠 **Reasoning Models** - Auto-detects thought-capable models
- 🔍 **Model Info** - Query specific model parameters

## Quick Start

```bash
# Check connection
/ollama-status

# List all models (with accurate context length)
/ollama-models

# Get detailed info for specific model
/ollama-info gemma3
/ollama-info llama3.1:70b
```

## Commands

| Command | Description |
|---------|-------------|
| `/ollama-status` | Check connection status |
| `/ollama-models` | List models with context length |
| `/ollama-info MODEL` | Show model details from `/api/show` |

## How It Works

The extension uses Ollama's `/api/show` endpoint to get accurate model information:

```bash
curl http://localhost:11434/api/show -d '{
  "model": "gemma3",
  "verbose": true
}'
```

Response includes:
- `model_info.context_length` - Accurate context window
- `capabilities` - ["completion", "vision"]
- `details.parameter_size` - "4.3B", "70B", etc.
- `details.family` - "gemma3", "llama", etc.

## Model Display

Models are displayed with accurate metadata:

```
📍 Local:
  👁️ gemma3 (4.3B) (131,072 ctx)
  🧠 codellama:70b (70B) (16,384 ctx)
  llama3.1 (8B) (128,000 ctx)
```

**Badges:**
- ☁️ Cloud model
- 👁️ Vision-capable
- 🧠 Reasoning-capable

## Configuration

Add to your pi settings (`~/.pi/agent/settings.json` or `.pi/settings.json`):

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "cloudUrl": "https://ollama.com",
    "apiKey": "your-ollama-cloud-api-key"
  }
}
```

Project settings override global settings. Environment variables still override settings at runtime:

```bash
export OLLAMA_BASE_URL="http://localhost:11434"
export OLLAMA_CLOUD_URL="https://ollama.com"
export OLLAMA_API_KEY="your-api-key"
```

## Local Development

```bash
git clone https://github.com/0xKobold/pi-ollama
cd pi-ollama
npm install
npm run build
pi install ./
```

## API Functions

```typescript
import { fetchModelDetails, getContextLength, hasVisionCapability } from '@0xkobold/pi-ollama';

// Get model details
const details = await fetchModelDetails('gemma3', 'http://localhost:11434');

// Extract context length
const ctx = getContextLength(details?.model_info); // 131072

// Check vision support
const hasVision = hasVisionCapability(details); // true
```

## Supported Capabilities

The extension detects:
- **Vision**: From `capabilities` array or `model_info` keys
- **Reasoning**: From model name (coder, r1, deepseek, think, reason)
- **Context Length**: From `model_info.*.context_length`

## License

MIT © 0xKobold
