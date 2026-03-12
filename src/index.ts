/**
 * Pi Ollama Extension - Working Version
 * 
 * Uses same config pattern as local extension
 */

import type { ExtensionAPI, ProviderModelConfig } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// Default config
const DEFAULT_CONFIG = {
  baseUrl: "http://localhost:11434",
  cloudUrl: "https://ollama.com",
  apiKey: "",
  defaultModel: "",
  customModels: [] as string[],
};

let CONFIG = { ...DEFAULT_CONFIG };

// Load from pi settings and env
function loadConfig(pi: ExtensionAPI) {
  // Reset to defaults first
  CONFIG = { ...DEFAULT_CONFIG };
  
  // Try pi.settings first
  const settings = (pi as any).settings;
  if (settings?.get) {
    CONFIG.baseUrl = settings.get("ollama.baseUrl") || CONFIG.baseUrl;
    CONFIG.apiKey = settings.get("ollama.apiKey") || CONFIG.apiKey;
    CONFIG.defaultModel = settings.get("ollama.defaultModel") || CONFIG.defaultModel;
    CONFIG.customModels = settings.get("ollama.customModels") || CONFIG.customModels;
  }
  
  // Environment override (runtime)
  if (typeof process !== 'undefined') {
    CONFIG.apiKey = process.env.OLLAMA_API_KEY || CONFIG.apiKey;
    CONFIG.baseUrl = process.env.OLLAMA_BASE_URL || CONFIG.baseUrl;
    CONFIG.defaultModel = process.env.OLLAMA_DEFAULT_MODEL || CONFIG.defaultModel;
  }
  
  console.log(`[pi-ollama] Config: baseUrl=${CONFIG.baseUrl}, hasApiKey=${!!CONFIG.apiKey}`);
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function testLocalConnection(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${CONFIG.baseUrl}/api/tags`, {}, 2000);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// MODEL DETECTION
// ============================================================================

interface ModelDetails {
  name: string;
  capabilities?: string[];
  model_info?: Record<string, any>;
  details?: {
    parameter_size?: string;
    family?: string;
    quantization_level?: string;
  };
}

async function fetchModelDetails(modelName: string): Promise<ModelDetails | null> {
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/show`, {
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

function getContextLength(modelInfo: Record<string, any> | undefined): number {
  if (!modelInfo) return 128000;
  
  const keys = Object.keys(modelInfo);
  for (const key of keys) {
    if (key.endsWith('.context_length') && typeof modelInfo[key] === 'number') {
      return modelInfo[key];
    }
  }
  return 128000;
}

function hasVisionCapability(details: ModelDetails): boolean {
  if (details.capabilities?.includes('vision')) return true;
  if (details.capabilities?.includes('image')) return true;
  return false;
}

function hasReasoningCapability(name: string): boolean {
  const lower = name.toLowerCase();
  return ['coder', 'r1', 'deepseek', 'kimi', 'think', 'reason'].some(k => lower.includes(k));
}

// ============================================================================
// MODEL CREATION
// ============================================================================

function createModel(name: string, isCloud: boolean, details?: ModelDetails): ProviderModelConfig {
  const contextWindow = details ? getContextLength(details.model_info) : 128000;
  const isVision = details ? hasVisionCapability(details) : false;
  const isReasoning = hasReasoningCapability(name);
  
  const cloudEmoji = isCloud ? '☁️ ' : '';
  const visionEmoji = isVision ? '👁️ ' : '';
  
  return {
    id: isCloud ? `${name}:cloud` : name,
    name: `${cloudEmoji}${visionEmoji}${name}`,
    api: 'openai-completions',
    reasoning: isReasoning,
    input: isVision ? ['text', 'image'] : ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens: 8192,
  };
}

// ============================================================================
// FETCH MODELS
// ============================================================================

async function fetchLocalModels(): Promise<ProviderModelConfig[]> {
  try {
    const response = await fetch(`${CONFIG.baseUrl}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    const models = data.models || [];
    
    const result: ProviderModelConfig[] = [];
    for (const m of models) {
      const details = await fetchModelDetails(m.name);
      result.push(createModel(m.name, false, details || undefined));
    }
    return result;
  } catch {
    return [];
  }
}

async function fetchCloudModels(): Promise<ProviderModelConfig[]> {
  if (!CONFIG.apiKey) return [];
  
  try {
    const response = await fetch(`${CONFIG.cloudUrl}/api/tags`, {
      headers: { Authorization: `Bearer ${CONFIG.apiKey}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    const models = data.models || [];
    
    return models.map((m: any) => createModel(m.name, true));
  } catch {
    return [];
  }
}

// ============================================================================
// COMMANDS
// ============================================================================

async function handleStatus(ctx: any) {
  const hasLocal = await testLocalConnection();
  const lines = [
    '🦙 Ollama Status',
    '',
    `Local: ${hasLocal ? '✅ Connected' : '❌ Not running'}`,
    `Cloud: ${CONFIG.apiKey ? '✅ API key set' : '❌ No API key'}`,
    '',
    `Base URL: ${CONFIG.baseUrl}`,
  ];
  ctx.ui?.notify?.(lines.join('\n'), 'info');
}

async function handleModelInfo(args: string, ctx: any) {
  const modelName = args.trim() || CONFIG.defaultModel;
  if (!modelName) {
    ctx.ui?.notify?.('Usage: /ollama-info MODEL_NAME', 'error');
    return;
  }
  
  const details = await fetchModelDetails(modelName);
  if (!details) {
    ctx.ui?.notify?.(`Could not fetch details for ${modelName}`, 'error');
    return;
  }
  
  const contextLength = getContextLength(details.model_info);
  const isVision = hasVisionCapability(details);
  const paramSize = details.details?.parameter_size || 'Unknown';
  const family = details.details?.family || 'Unknown';
  
  const lines = [
    `🦙 Model: ${modelName}`,
    '',
    `Family: ${family}`,
    `Parameters: ${paramSize}`,
    `Context: ${contextLength.toLocaleString()} tokens`,
    `Vision: ${isVision ? '✅' : '❌'}`,
  ];
  
  if (details.capabilities?.length) {
    lines.push('', `Capabilities: ${details.capabilities.join(', ')}`);
  }
  
  ctx.ui?.notify?.(lines.join('\n'), 'info');
}

async function handleModels(pi: ExtensionAPI, ctx: any) {
  const [localModels, cloudModels] = await Promise.all([fetchLocalModels(), fetchCloudModels()]);
  
  const lines = ['🦙 Available Models', ''];
  
  if (localModels.length > 0) {
    lines.push('📍 Local:');
    localModels.forEach(m => {
      const vision = m.input?.includes('image') ? '👁️' : '';
      lines.push(`  ${vision} ${m.name} (${m.contextWindow.toLocaleString()} ctx)`);
    });
    lines.push('');
  }
  
  if (cloudModels.length > 0) {
    lines.push('☁️ Cloud:');
    cloudModels.forEach(m => {
      const vision = m.input?.includes('image') ? '👁️' : '';
      lines.push(`  ${vision} ${m.name} (${m.contextWindow.toLocaleString()} ctx)`);
    });
  }
  
  if (localModels.length === 0 && cloudModels.length === 0) {
    lines.push('No models found. Ensure Ollama is running locally or set API key for cloud.');
  }
  
  ctx.ui?.notify?.(lines.join('\n'), 'info');
  
  // Register models using official pi API
  // Pi requires apiKey, so use dummy for local
  const effectiveApiKey = CONFIG.apiKey || 'ollama-local';
  const allModels = [...localModels, ...cloudModels];
  if (allModels.length > 0) {
    pi.registerProvider('ollama', {
      baseUrl: CONFIG.baseUrl,
      apiKey: effectiveApiKey,
      api: 'openai-completions',
      models: allModels,
    });
    console.log(`[pi-ollama] Registered ${localModels.length} local, ${cloudModels.length} cloud models`);
  }
}

// ============================================================================
// EXTENSION EXPORT
// ============================================================================

export default async function ollamaExtension(pi: ExtensionAPI) {
  loadConfig(pi);
  
  pi.registerCommand('ollama-status', {
    description: 'Check Ollama connection status',
    handler: async (_args: string, ctx: any) => handleStatus(ctx),
  });
  
  pi.registerCommand('ollama-info', {
    description: 'Show model details',
    handler: async (args: string, ctx: any) => handleModelInfo(args, ctx),
  });
  
  pi.registerCommand('ollama-models', {
    description: 'List available models',
    handler: async (_args: string, ctx: any) => handleModels(pi, ctx),
  });
  
  pi.registerCommand('ollama', {
    description: 'Ollama management',
    handler: async (args: string, ctx: any) => {
      const [sub] = args.trim().split(/\s+/);
      switch (sub) {
        case 'status': return handleStatus(ctx);
        case 'info': return handleModelInfo(args.slice(4).trim(), ctx);
        case 'models': return handleModels(pi, ctx);
        default:
          ctx.ui?.notify?.([
            '🦙 Ollama Commands',
            '',
            '/ollama status  - Check connection',
            '/ollama info MODEL  - Show model details',
            '/ollama models  - List models',
          ].join('\n'), 'info');
      }
    },
  });
  
  console.log(`[pi-ollama] Config loaded: baseUrl=${CONFIG.baseUrl}, hasApiKey=${!!CONFIG.apiKey}`);
  
  // Register models on startup with retry
  console.log('[pi-ollama] Fetching models...');
  try {
    await handleModels(pi, { ui: { notify: () => {} } });
  } catch (err) {
    console.error('[pi-ollama] Error fetching models:', err);
  }
  
  console.log('[pi-ollama] Extension loaded');
}

// Re-exports for TypeScript
export {
  fetchLocalModels,
  fetchCloudModels,
  fetchModelDetails,
  getContextLength,
  hasVisionCapability,
  hasReasoningCapability,
  createModel,
};
