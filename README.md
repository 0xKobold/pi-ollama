# Pi Ollama Extension

Unified local + cloud Ollama support for [pi-coding-agent](https://github.com/badlogic/pi-mono).

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

# Or temporary (for testing)
pi -e npm:@0xkobold/pi-ollama
```

## Features

- 🖥️ **Local Ollama** - Connect to localhost:11434
- ☁️ **Ollama Cloud** - Use ollama.com with API key
- 🧠 **Auto-discovery** - Lists all available models
- 🔍 **Capability detection** - Reasoning & vision models
- 📝 **TypeScript** - Full type support

## Commands

```bash
/ollama-status    # Check connection status
/ollama-models    # List and register models
```

## Configuration

Add to your pi settings (`~/.pi/agent/settings.json`):

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "apiKey": "your-ollama-cloud-api-key",
    "defaultModel": "llama3.1",
    "customModels": ["my-custom-model"]
  }
}
```

Or set via environment:
```bash
export OLLAMA_BASE_URL="http://localhost:11434"
export OLLAMA_API_KEY="your-api-key"
```

## Local Development

```bash
git clone https://github.com/0xKobold/pi-ollama
cd pi-ollama
npm install
npm run build

# Link for testing
pi install ./
```

## Model Badges

Models are automatically annotated:
- ☁️ Cloud model
- 👁️ Vision-capable (multimodal)
- 🧠 Reasoning-capable

## License

MIT © 0xKobold
