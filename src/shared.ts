/**
 * Shared Ollama Utilities
 *
 * DRY: Shared between pi-ollama extension and internal app usage
 * This module has no pi-coding-agent dependencies - pure Ollama client logic
 */

import { Ollama } from 'ollama';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface OllamaConfig {
  baseUrl: string;
  cloudUrl: string;
  apiKey: string | undefined;
}

export const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  cloudUrl: 'https://ollama.com',
  apiKey: undefined,
};

/**
 * Load config from environment variables
 */
export function loadConfigFromEnv(): Partial<OllamaConfig> {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL,
    cloudUrl: process.env.OLLAMA_CLOUD_URL,
    apiKey: process.env.OLLAMA_API_KEY,
  };
}

// ============================================================================
// CLIENT MANAGEMENT
// ============================================================================

export interface OllamaClients {
  local: Ollama;
  cloud: Ollama | null;
  hasApiKey: boolean;
}

/**
 * Create Ollama clients based on config
 */
export function createClients(config: Partial<OllamaConfig> = {}): OllamaClients {
  const merged = { ...DEFAULT_CONFIG, ...config };

  const local = new Ollama({ host: merged.baseUrl });
  const cloud = merged.apiKey
    ? new Ollama({
        host: merged.cloudUrl,
        headers: { Authorization: `Bearer ${merged.apiKey}` },
      })
    : null;

  return {
    local,
    cloud,
    hasApiKey: !!merged.apiKey,
  };
}

/**
 * Detect if local Ollama is running
 */
export async function isLocalRunning(client: Ollama): Promise<boolean> {
  try {
    await client.list();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the appropriate client for a model
 * Cloud models have :cloud suffix
 */
export function getClientForModel(
  modelId: string,
  clients: OllamaClients,
  cloudOnly: boolean = false
): { client: Ollama; isCloud: boolean } {
  const isCloudModel = modelId.includes(':cloud');

  if ((isCloudModel || cloudOnly) && clients.cloud) {
    return { client: clients.cloud, isCloud: true };
  }

  return { client: clients.local, isCloud: false };
}

/**
 * Strip cloud suffix from model name
 */
export function getModelName(modelId: string): string {
  return modelId.replace(':cloud', '');
}

// ============================================================================
// MODEL DETECTION
// ============================================================================

export interface ModelDetails {
  name: string;
  capabilities?: string[];
  model_info?: Record<string, any>;
  details?: {
    parameter_size?: string;
    family?: string;
    quantization_level?: string;
  };
}

/**
 * Fetch detailed model info from /api/show
 */
export async function fetchModelDetails(
  client: Ollama,
  modelName: string
): Promise<ModelDetails | null> {
  try {
    const info = await client.show({ model: modelName });
    return {
      name: modelName,
      model_info: info.model_info,
      details: {
        parameter_size: info.details?.parameter_size,
        family: info.details?.family,
        quantization_level: info.details?.quantization_level,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Extract context length from model info
 */
export function getContextLength(modelInfo: Record<string, any> | undefined): number {
  if (!modelInfo) return 128000;

  const keys = Object.keys(modelInfo);
  for (const key of keys) {
    if (key.endsWith('.context_length') && typeof modelInfo[key] === 'number') {
      return modelInfo[key];
    }
  }
  return 128000;
}

/**
 * Check if model has vision capability
 */
export function hasVisionCapability(details: ModelDetails): boolean {
  if (details.capabilities?.includes('vision')) return true;
  if (details.capabilities?.includes('image')) return true;
  return false;
}

/**
 * Check if model name suggests reasoning capability
 */
export function hasReasoningCapability(name: string): boolean {
  const lower = name.toLowerCase();
  return ['coder', 'r1', 'deepseek', 'kimi', 'think', 'reason'].some((k) =>
    lower.includes(k)
  );
}

// ============================================================================
// MODEL LISTING
// ============================================================================

export interface ListedModel {
  name: string;
  isCloud: boolean;
  details?: ModelDetails;
}

/**
 * List all available models from local and cloud
 */
export async function listAllModels(clients: OllamaClients): Promise<ListedModel[]> {
  const models: ListedModel[] = [];

  // Try local first
  try {
    const localModels = await clients.local.list();
    for (const m of localModels.models || []) {
      const details = await fetchModelDetails(clients.local, m.name);
      models.push({
        name: m.name,
        isCloud: false,
        details: details || undefined,
      });
    }
  } catch {
    // Local not available
  }

  // Try cloud if we have API key
  if (clients.cloud) {
    try {
      const cloudModels = await clients.cloud.list();
      for (const m of cloudModels.models || []) {
        // Skip if already have locally
        if (models.some((lm) => lm.name === m.name)) continue;

        const details = await fetchModelDetails(clients.cloud, m.name);
        models.push({
          name: `${m.name}:cloud`,
          isCloud: true,
          details: details || undefined,
        });
      }
    } catch {
      // Cloud not available
    }
  }

  return models;
}

// ============================================================================
// CHAT UTILITIES
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatResult {
  content: string;
  usage: ChatUsage;
}

/**
 * Non-streaming chat completion
 */
export async function chat(
  client: Ollama,
  options: ChatOptions
): Promise<ChatResult> {
  const response = await client.chat({
    model: options.model,
    messages: options.messages,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 4096,
    },
  });

  return {
    content: response.message?.content ?? '',
    usage: {
      inputTokens: (response as any).prompt_eval_count ?? 0,
      outputTokens: (response as any).eval_count ?? 0,
    },
  };
}

/**
 * Streaming chat completion
 */
export async function* chatStream(
  client: Ollama,
  options: ChatOptions
): AsyncGenerator<string, void, unknown> {
  const stream = await client.chat({
    model: options.model,
    messages: options.messages,
    stream: true,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 4096,
    },
  });

  for await (const chunk of stream) {
    if (chunk.message?.content) {
      yield chunk.message.content;
    }
  }
}
