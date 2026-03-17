/**
 * Pi Ollama Extension - Using Official ollama-js Client
 *
 * Uses the official Ollama JavaScript client for proper cloud/local API handling
 * https://github.com/ollama/ollama-js
 */

import type { ExtensionAPI, ProviderModelConfig } from "@mariozechner/pi-coding-agent";
import { Ollama } from 'ollama';
import {
  loadConfigFromEnv,
  createClients,
  isLocalRunning,
  getClientForModel,
  getModelName,
  fetchModelDetails,
  getContextLength,
  hasVisionCapability,
  hasReasoningCapability,
  listAllModels,
  type OllamaConfig,
  type OllamaClients,
  type ModelDetails,
  type ListedModel,
} from './shared.js';

// Re-export shared utilities for consumers
export {
  loadConfigFromEnv,
  createClients,
  isLocalRunning,
  getClientForModel,
  getModelName,
  fetchModelDetails,
  getContextLength,
  hasVisionCapability,
  hasReasoningCapability,
  listAllModels,
  type OllamaConfig,
  type OllamaClients,
  type ModelDetails,
  type ListedModel,
} from './shared.js';

// Default config
const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: "http://localhost:11434",
  cloudUrl: "https://ollama.com",
  apiKey: "",
};

let CONFIG: OllamaConfig = { ...DEFAULT_CONFIG };
let clients: OllamaClients | null = null;

// Load from pi settings and env
function loadConfig(pi: ExtensionAPI) {
  // Reset to defaults first
  CONFIG = { ...DEFAULT_CONFIG };

  // Try pi.settings first
  const settings = (pi as any).settings;
  if (settings?.get) {
    CONFIG.baseUrl = settings.get("ollamaBaseUrl") || CONFIG.baseUrl;
    CONFIG.cloudUrl = settings.get("ollamaCloudUrl") || CONFIG.cloudUrl;
    CONFIG.apiKey = settings.get("ollamaApiKey") || CONFIG.apiKey;
  }

  // Environment override (runtime)
  if (typeof process !== 'undefined') {
    CONFIG = { ...CONFIG, ...loadConfigFromEnv() };
  }

  // Initialize clients
  clients = createClients(CONFIG);

  console.log(`[pi-ollama] Config: baseUrl=${CONFIG.baseUrl}, cloudUrl=${CONFIG.cloudUrl}, hasApiKey=${!!CONFIG.apiKey}`);
}

// ============================================================================
// MODEL CREATION
// ============================================================================

function createModel(name: string, isCloud: boolean, details?: ModelDetails): ProviderModelConfig {
  // Get context window from model details (which contains model_info), or fall back to model name patterns
  // getContextLength handles both nested model_info and direct model_info objects
  const contextWindow = getContextLength(details || null, name);
  const isVision = details ? hasVisionCapability(details) : false;
  const isReasoning = hasReasoningCapability(name);

  // Debug: log context window detection
  console.log(`[pi-ollama] Model ${name}: contextWindow=${contextWindow} (${details ? 'from details' : 'from name pattern'})`);
  if (details?.model_info) {
    const info = details.model_info as Record<string, unknown>;
    const ctxKeys = Object.keys(info).filter(k => k.includes('context'));
    console.log(`[pi-ollama] Model ${name}: found context keys: ${ctxKeys.join(', ')}`);
  }

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
  if (!clients) return [];

  try {
    const response = await clients.local.list();
    const models = response.models || [];

    console.log(`[pi-ollama] Raw models from local: ${models.map((m: any) => m.name).join(', ')}`);

    const result: ProviderModelConfig[] = [];
    for (const m of models) {
      const details = await fetchModelDetails(clients.local, m.name);
      console.log(`[pi-ollama] Processing ${m.name}: details=${details ? 'found' : 'not found'}`);
      result.push(createModel(m.name, false, details || undefined));
    }

    console.log(`[pi-ollama] Created ${result.length} local models: ${result.map(m => m.id).join(', ')}`);
    return result;
  } catch (err) {
    console.log(`[pi-ollama] Error fetching local models: ${err}`);
    return [];
  }
}

// Default cloud models to register even without API key
const DEFAULT_CLOUD_MODELS = [
  'kimi-k2.5',
  'llama3.3',
  'qwen2.5',
  'mistral',
  'codellama',
  'deepseek-r1',
  'gemma2',
];

async function fetchCloudModels(): Promise<ProviderModelConfig[]> {
  if (!clients) return [];

  // If we have a cloud client with API key, fetch actual models
  if (clients.cloud) {
    try {
      const response = await clients.cloud.list();
      const models = response.models || [];
      return models.map((m: any) => createModel(m.name, true));
    } catch {
      // Fall through to default models
    }
  }

  // Register default cloud models even without API key
  return DEFAULT_CLOUD_MODELS.map(name => createModel(name, true));
}

// ============================================================================
// COMMANDS
// ============================================================================

async function handleStatus(ctx: any) {
  if (!clients) {
    ctx.ui?.notify?.('Ollama not initialized', 'error');
    return;
  }

  const hasLocal = await isLocalRunning(clients.local);

  const lines = [
    '🦙 Ollama Status',
    '',
    `Local: ${hasLocal ? '✅ Connected' : '❌ Not running'}`,
    `Cloud: ${CONFIG.apiKey ? '✅ API key set' : '❌ No API key'}`,
    '',
    `Base URL: ${CONFIG.baseUrl}`,
    `Cloud URL: ${CONFIG.cloudUrl}`,
  ];
  ctx.ui?.notify?.(lines.join('\n'), 'info');
}

async function handleModelInfo(args: string, ctx: any) {
  const modelName = args.trim() || CONFIG.baseUrl;
  if (!modelName) {
    ctx.ui?.notify?.('Usage: /ollama-info MODEL_NAME', 'error');
    return;
  }

  if (!clients) {
    ctx.ui?.notify?.('Ollama not initialized', 'error');
    return;
  }

  let details: ModelDetails | null = null;
  let isCloud = false;

  // Try local first
  details = await fetchModelDetails(clients.local, modelName);

  // Try cloud if not found locally
  if (!details && clients.cloud) {
    details = await fetchModelDetails(clients.cloud, modelName);
    isCloud = true;
  }

  if (!details) {
    ctx.ui?.notify?.(`Could not fetch details for ${modelName}`, 'error');
    return;
  }

  const contextLength = getContextLength(((details?.model_info ?? details) ?? undefined) ?? undefined);
  const isVision = hasVisionCapability(details);
  const paramSize = (details.details?.parameter_size ?? details?.parameter_size) || 'Unknown';
  const family = details.families?.find(f => f !== undefined) ?? 'Unknown';

  const lines = [
    `🦙 Model: ${modelName}${isCloud ? ' (cloud)' : ''}`,
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

  // Get local model IDs to filter out cloud models that exist locally
  const localModelIds = new Set(localModels.map(m => m.id.replace(':cloud', '')));

  // Filter cloud models - only register ones NOT available locally
  const uniqueCloudModels = cloudModels.filter(m => !localModelIds.has(m.id.replace(':cloud', '')));

  // Register local models (includes cloud models pulled locally)
  if (localModels.length > 0) {
    console.log(`[pi-ollama] About to register provider 'ollama' with ${localModels.length} models`);
    console.log(`[pi-ollama] Model IDs: ${localModels.map(m => m.id).join(', ')}`);
    try {
      pi.registerProvider('ollama', {
        baseUrl: `${CONFIG.baseUrl}/v1`,  // OpenAI-compatible endpoint
        apiKey: 'ollama',
        api: 'openai-completions',
        models: localModels,
      });
      console.log(`[pi-ollama] Registered ${localModels.length} local models with baseUrl=${CONFIG.baseUrl}/v1`);
    } catch (err) {
      console.error(`[pi-ollama] Failed to register provider:`, err);
    }
  }

  // Register cloud models separately with cloud URL (only if not available locally)
  if (uniqueCloudModels.length > 0 && clients?.cloud) {
    pi.registerProvider('ollama-cloud', {
      baseUrl: CONFIG.cloudUrl,
      apiKey: CONFIG.apiKey,
      api: 'openai-completions',
      models: uniqueCloudModels,
    });
    console.log(`[pi-ollama] Registered ${uniqueCloudModels.length} cloud models with baseUrl=${CONFIG.cloudUrl}`);
  } else if (uniqueCloudModels.length > 0) {
    console.log(`[pi-ollama] Skipped ${uniqueCloudModels.length} cloud models (no API key)`);
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

  console.log(`[pi-ollama] Config loaded: baseUrl=${CONFIG.baseUrl}, cloudUrl=${CONFIG.cloudUrl}, hasApiKey=${!!CONFIG.apiKey}`);

  // Register models on startup with retry
  console.log('[pi-ollama] Fetching models...');
  try {
    await handleModels(pi, { ui: { notify: () => { } } });
  } catch (err) {
    console.error('[pi-ollama] Error fetching models:', err);
  }

  console.log('[pi-ollama] Extension loaded');
}