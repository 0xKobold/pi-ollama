/**
 * Rich Ollama Model Listing
 * 
 * Combines /api/tags (model list + basic details) 
 * with /api/show (context length + capabilities)
 */

const LOCAL_URL = "http://localhost:11434";

interface TagModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface ShowModel {
  model_info?: Record<string, any>;
  capabilities?: string[];
}

async function fetchTags(): Promise<TagModel[]> {
  try {
    const response = await fetch(`${LOCAL_URL}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models || [];
  } catch {
    return [];
  }
}

async function fetchShow(modelName: string): Promise<ShowModel | null> {
  try {
    const response = await fetch(`${LOCAL_URL}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function extractContextLength(modelInfo: Record<string, any> | undefined): number | null {
  if (!modelInfo) return null;
  
  for (const [key, value] of Object.entries(modelInfo)) {
    if (key.endsWith('.context_length') && typeof value === 'number') {
      return value;
    }
  }
  return null;
}

function getModelEmoji(family?: string): string {
  const emojis: Record<string, string> = {
    'llama': '🦙',
    'gemma': '💎',
    'qwen': '🌐',
    'qwen3moe': '🌐',
    'nomic-bert': '📊',
    'gptoss': '🧠',
    'mixtral': '🌪️',
    'kimi': '🦀',
    'minimax': '🔊',
    'mistral': '🌬️',
    'claude': '📚',
    'gpt': '🤖',
  };
  return emojis[family?.toLowerCase() || ''] || '📦';
}

async function main() {
  console.log("🔍 Rich Ollama Model Listing\n");
  
  const models = await fetchTags();
  
  if (models.length === 0) {
    console.log("❌ No models found or Ollama not running");
    console.log("Make sure Ollama is started: ollama serve");
    return;
  }
  
  console.log(`Found ${models.length} model(s):\n`);
  
  for (const model of models) {
    const showData = await fetchShow(model.name);
    const contextLength = extractContextLength(showData?.model_info);
    const emoji = getModelEmoji(model.details?.family);
    const isCloud = model.name.includes(':cloud') || !contextLength;
    
    console.log("═".repeat(70));
    console.log(`${emoji} ${model.name}${isCloud ? ' ☁️' : ''}`);
    console.log("═".repeat(70));
    
    // Basic info from /api/tags
    console.log(`  📁 Size: ${formatFileSize(model.size)}`);
    if (model.details) {
      const d = model.details;
      if (d.family) console.log(`  🏷️  Family: ${d.family}`);
      if (d.parameter_size) console.log(`  📊 Parameters: ${d.parameter_size}`);
      if (d.quantization_level) console.log(`  🔧 Quantization: ${d.quantization_level}`);
      if (d.format) console.log(`  📦 Format: ${d.format.toUpperCase()}`);
    }
    
    // Context length from /api/show (if available)
    if (contextLength) {
      console.log(`  📏 Context: ${contextLength.toLocaleString()} tokens`);
    } else if (isCloud) {
      // Use name inference for cloud models
      const nameLower = model.name.toLowerCase();
      let inferred = 128000;
      if (nameLower.includes('kimi')) inferred = 256000;
      else if (nameLower.includes('minimax')) inferred = 256000;
      else if (nameLower.includes('qwen3')) inferred = 262144;
      else if (nameLower.includes('gptoss')) inferred = 131072;
      console.log(`  📏 Context: ~${inferred.toLocaleString()} tokens (inferred)`);
    }
    
    // Capabilities from /api/show
    if (showData?.capabilities && showData.capabilities.length > 0) {
      const caps = showData.capabilities.map(c => {
        if (c === 'vision') return '👁️  Vision';
        if (c === 'tools') return '🔧 Tools';
        if (c === 'completion') return '✍️  Completion';
        if (c === 'thinking') return '🧠 Thinking';
        if (c === 'embedding') return '📊 Embedding';
        return c;
      }).join(' • ');
      console.log(`  ⚡ Capabilities: ${caps}`);
    }
    
    // Modified date
    if (model.modified_at) {
      const date = new Date(model.modified_at).toLocaleDateString();
      console.log(`  🕐 Updated: ${date}`);
    }
    
    // Show model_info keys if available
    if (showData?.model_info && Object.keys(showData.model_info).length > 0) {
      const keys = Object.keys(showData.model_info);
      const ctxKeys = keys.filter(k => k.includes('context_length') || k.includes('embedding'));
      if (ctxKeys.length > 0) {
        console.log(`  🔑 Keys: ${ctxKeys.join(', ')}`);
      }
    }
    
    console.log();
  }
  
  // Summary table
  console.log("═".repeat(70));
  console.log("📊 Summary Table");
  console.log("═".repeat(70));
  console.log();
  console.log(`${'Model'.padEnd(25)} ${'Family'.padEnd(12)} ${'Params'.padEnd(8)} ${'Context'.padEnd(10)} Cloud?`);
  console.log("-".repeat(70));
  
  for (const model of models) {
    const showData = await fetchShow(model.name);
    const context = extractContextLength(showData?.model_info);
    const isCloud = model.name.includes(':cloud') || !context;
    
    let ctxStr = '?';
    if (context) {
      ctxStr = (context / 1000).toFixed(0) + 'K';
    } else if (isCloud) {
      const nameLower = model.name.toLowerCase();
      if (nameLower.includes('kimi')) ctxStr = '256K';
      else if (nameLower.includes('minimax')) ctxStr = '256K';
      else if (nameLower.includes('qwen3')) ctxStr = '262K';
      else if (nameLower.includes('gptoss')) ctxStr = '131K';
      else ctxStr = '128K';
    }
    
    const name = model.name.slice(0, 24).padEnd(25);
    const family = (model.details?.family || '?').padEnd(12);
    const params = (model.details?.parameter_size || '?').padEnd(8);
    const ctx = ctxStr.padEnd(10);
    
    console.log(`${name} ${family} ${params} ${ctx} ${isCloud ? '☁️' : '📍'}`);
  }
  
  console.log();
  console.log("═".repeat(70));
  console.log("✅ Listing Complete");
  console.log("═".repeat(70));
}

main();
