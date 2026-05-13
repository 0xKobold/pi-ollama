/**
 * Pi Ollama Extension — Unified local + cloud Ollama support
 *
 * Uses the official Ollama JavaScript client for proper cloud/local API handling.
 * See: https://docs.ollama.com/
 */

import type { ExtensionAPI, ProviderModelConfig } from "@mariozechner/pi-coding-agent";
import {
  DEFAULT_CONFIG,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_MAX_TOKENS,
  createClients,
  isLocalRunning,
  fetchModelDetails,
  getContextLength,
  hasVisionCapability,
  hasReasoningCapability,
  loadConfigFromEnv,
  loadConfigFromSettingsFiles,
  type OllamaConfig,
  type OllamaClients,
  type OllamaExtensionState,
  type ModelDetails,
} from './shared.js';

// ============================================================================
// LOGGING
// ============================================================================

const log = {
  info: (msg: string, ...args: unknown[]) => console.log(`[pi-ollama] ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => console.debug(`[pi-ollama] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[pi-ollama] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[pi-ollama] ${msg}`, ...args),
};

// Re-export utilities for consumers
export {
  fetchModelDetails,
  getContextLength,
  hasVisionCapability,
  hasReasoningCapability,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_MAX_TOKENS,
  OllamaError,
  OllamaRateLimitError,
  OllamaAuthError,
  OllamaModelError,
  OllamaServerError,
  classifyHttpError,
} from './shared.js';

// ============================================================================
// TYPES
// ============================================================================

interface ExtensionContext {
  ui?: {
    notify?: (message: string, type?: 'info' | 'error' | 'warning') => void;
  };
  pi?: ExtensionAPI;
}

interface PiSettings {
  get?: (key: string) => unknown;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Initializes the extension state from pi settings and environment variables.
 *
 * Config priority (highest wins):
 * 1. Environment variables (OLLAMA_HOST, OLLAMA_HOST_CLOUD, OLLAMA_API_KEY)
 * 2. pi.settings runtime API
 * 3. .pi/settings.json (project-local)
 * 4. ~/.pi/agent/settings.json (global)
 * 5. DEFAULT_CONFIG
 */
async function initializeState(pi: ExtensionAPI): Promise<OllamaExtensionState> {
  let config = { ...DEFAULT_CONFIG };

  // Use standardized keys: pi-ollama.baseUrl, pi-ollama.cloudUrl, pi-ollama.apiKey
  const settings = (pi as unknown as { settings?: PiSettings }).settings;
  if (settings?.get) {
    config.baseUrl = (settings.get("pi-ollama.baseUrl") as string) ?? config.baseUrl;
    config.cloudUrl = (settings.get("pi-ollama.cloudUrl") as string) ?? config.cloudUrl;
    config.apiKey = (settings.get("pi-ollama.apiKey") as string) ?? config.apiKey;
  } else {
    // Fallback: read from settings files directly
    const fileConfig = await loadConfigFromSettingsFiles();
    if (fileConfig.baseUrl) config.baseUrl = fileConfig.baseUrl;
    if (fileConfig.cloudUrl) config.cloudUrl = fileConfig.cloudUrl;
    if (fileConfig.apiKey) config.apiKey = fileConfig.apiKey;
  }

  // Environment override (highest priority)
  const envConfig = loadConfigFromEnv();
  config = { ...config, ...envConfig };

  const clients = createClients(config);

  log.info(`State initialized: baseUrl=${config.baseUrl}, cloudUrl=${config.cloudUrl}, hasApiKey=${!!config.apiKey}`);

  return { config, clients };
}

// ============================================================================
// MODEL CREATION
// ============================================================================

function createModel(name: string, isCloud: boolean, details?: ModelDetails): ProviderModelConfig {
  const contextWindow = getContextLength(details || null, name);
  const isVision = details ? hasVisionCapability(details) : false;
  const isReasoning = hasReasoningCapability(name, details);

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
    maxTokens: Math.min(contextWindow, 16384),
  };
}

// ============================================================================
// FETCH MODELS
// ============================================================================

async function fetchLocalModels(state: OllamaExtensionState): Promise<ProviderModelConfig[]> {
  const { clients } = state;
  try {
    const response = await clients.local.list();
    const models = response.models || [];

    const result: ProviderModelConfig[] = [];
    for (const m of models) {
      const details = await fetchModelDetails(clients.local, m.name);
      result.push(createModel(m.name, false, details || undefined));
    }
    return result;
  } catch (err) {
    log.debug(`Error fetching local models: ${err}`);
    return [];
  }
}

const DEFAULT_CLOUD_MODELS = [
  'kimi-k2.5', 'llama3.3', 'qwen3', 'mistral', 'codellama', 'deepseek-r1', 'gemma3',
];

async function fetchCloudModels(state: OllamaExtensionState): Promise<ProviderModelConfig[]> {
  const { clients } = state;
  if (clients.cloud) {
    try {
      const response = await clients.cloud.list();
      const models = response.models || [];
      return models.map((m: { name: string }) => createModel(m.name, true));
    } catch (err) {
      log.debug(`Error fetching cloud models, using defaults: ${err}`);
    }
  }
  return DEFAULT_CLOUD_MODELS.map(name => createModel(name, true));
}

// ============================================================================
// COMMANDS
// ============================================================================

async function handleStatus(state: OllamaExtensionState, ctx: ExtensionContext) {
  const { clients, config } = state;
  const hasLocal = await isLocalRunning(clients.local);

  const lines = [
    '🦙 Ollama Status',
    '',
    `Local: ${hasLocal ? '✅ Connected' : '❌ Not running'}`,
    `Cloud: ${config.apiKey ? '✅ API key set' : '❌ No API key'}`,
    '',
    `Base URL: ${config.baseUrl}`,
    `Cloud URL: ${config.cloudUrl}`,
  ];
  ctx.ui?.notify?.(lines.join('\n'), 'info');
}

async function handleModelInfo(state: OllamaExtensionState, args: string, ctx: ExtensionContext) {
  const modelName = args.trim();
  if (!modelName) {
    ctx.ui?.notify?.('Usage: /ollama-info MODEL_NAME', 'error');
    return;
  }

  const { clients } = state;
  let details: ModelDetails | null = null;
  let isCloud = false;

  details = await fetchModelDetails(clients.local, modelName);
  if (!details && clients.cloud) {
    details = await fetchModelDetails(clients.cloud, modelName);
    isCloud = true;
  }

  if (!details) {
    ctx.ui?.notify?.(`Could not fetch details for ${modelName}`, 'error');
    return;
  }

  const contextLength = getContextLength(details);
  const isVision = hasVisionCapability(details);
  const isReasoning = hasReasoningCapability(modelName, details);
  const paramSize = (details.details?.parameter_size ?? details?.parameter_size) || 'Unknown';
  const family = details.families?.[0] ?? details.details?.family ?? 'Unknown';

  const lines = [
    `🦙 Model: ${modelName}${isCloud ? ' (cloud)' : ''}`,
    '',
    `Family: ${family}`,
    `Parameters: ${paramSize}`,
    `Context: ${contextLength.toLocaleString()} tokens`,
    `Vision: ${isVision ? '✅' : '❌'}`,
    `Reasoning: ${isReasoning ? '✅' : '❌'}`,
  ];

  if (details.capabilities?.length) {
    lines.push('', `Capabilities: ${details.capabilities.join(', ')}`);
  }

  ctx.ui?.notify?.(lines.join('\n'), 'info');
}

async function handleModels(pi: ExtensionAPI, state: OllamaExtensionState, ctx: ExtensionContext) {
  const [localModels, cloudModels] = await Promise.all([fetchLocalModels(state), fetchCloudModels(state)]);

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

  const localModelIds = new Set(localModels.map(m => m.id.replace(':cloud', '')));
  const uniqueCloudModels = cloudModels.filter(m => !localModelIds.has(m.id.replace(':cloud', '')));

  if (localModels.length > 0) {
    try {
      pi.registerProvider('ollama', {
        baseUrl: `${state.config.baseUrl}/v1`,
        apiKey: 'ollama',
        api: 'openai-completions',
        models: localModels,
      });
    } catch (err) {
      log.error(`Failed to register provider:`, err);
    }
  }

  if (uniqueCloudModels.length > 0 && state.clients.cloud) {
    const cloudBase = state.config.cloudUrl.replace(/\/+$/, '');
    const cloudBaseUrl = cloudBase.endsWith('/v1') ? cloudBase : `${cloudBase}/v1`;
    pi.registerProvider('ollama-cloud', {
      baseUrl: cloudBaseUrl,
      apiKey: state.config.apiKey,
      api: 'openai-completions',
      models: uniqueCloudModels,
    });
  }
}

// ============================================================================
// EXTENSION EXPORT
// ============================================================================

export default async function ollamaExtension(pi: ExtensionAPI) {
  const state = await initializeState(pi);

  pi.registerCommand('ollama-status', {
    description: 'Check Ollama connection status',
    handler: async (_args: string, ctx: any) => handleStatus(state, ctx as ExtensionContext),
  });

  pi.registerCommand('ollama-info', {
    description: 'Show model details',
    handler: async (args: string, ctx: any) => handleModelInfo(state, args, ctx as ExtensionContext),
  });

  pi.registerCommand('ollama-models', {
    description: 'List available models',
    handler: async (_args: string, ctx: any) => handleModels(pi, state, ctx as ExtensionContext),
  });

  pi.registerCommand('ollama', {
    description: 'Ollama management',
    handler: async (args: string, ctx: any) => {
      const context = ctx as ExtensionContext;
      const [sub] = args.trim().split(/\s+/);
      switch (sub) {
        case 'status': return handleStatus(state, context);
        case 'info': return handleModelInfo(state, args.slice(4).trim(), context);
        case 'models': return handleModels(pi, state, context);
        default:
          context.ui?.notify?.([
            '🦙 Ollama Commands',
            '',
            '/ollama status  - Check connection',
            '/ollama info MODEL  - Show model details',
            '/ollama models  - List models',
          ].join('\n'), 'info');
      }
    },
  });

  try {
    await handleModels(pi, state, { ui: { notify: () => { } } });
  } catch (err) {
    log.error(`Error during initial model fetch:`, err);
  }

  log.info('Extension loaded');
}