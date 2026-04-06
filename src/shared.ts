/**
 * Shared Ollama Utilities - Official Ollama Client Approach
 *
 * Uses the official Ollama JavaScript client for proper cloud/local API handling
 * https://github.com/ollama/ollama-js
 */

import { Ollama } from 'ollama';

import { Type, Static } from '@sinclair/typebox';
import { Ollama } from 'ollama';

// ============================================================================
// SCHEMAS
// ============================================================================

export const OllamaConfigSchema = Type.Object({
  baseUrl: Type.String({ default: "http://localhost:11434" }),
  cloudUrl: Type.String({ default: "https://ollama.com" }),
  apiKey: Type.String({ default: "" }),
});

export type OllamaConfig = Static<typeof OllamaConfigSchema>;

export const OllamaClientsSchema = Type.Object({
  local: Type.Any(), // Ollama client instance
  cloud: Type.Optional(Type.Any()),
});

export type OllamaClients = Static<typeof OllamaClientsSchema>;

export const OllamaExtensionStateSchema = Type.Object({
  config: OllamaConfigSchema,
  clients: OllamaClientsSchema,
});

export type OllamaExtensionState = Static<typeof OllamaExtensionStateSchema>;

export interface ModelDetails {
  model_info?: {
    parameter_size?: string;
    quantization_level?: string;
    [key: string]: any;
  };
  details?: {
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
    [key: string]: any;
  };
  capabilities?: string[];
  parameter_size?: string;
  quantization_level?: string;
  families?: string[];
}

export interface ListedModel {
  name: string;
  size?: number;
  modified_at?: string;
  digest?: string;
  details?: {
    parameter_size?: string;
    family?: string;
    families?: string[];
    variant?: string;
    quantization_level?: string;
  };
}

// Default configuration values
export const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: "http://localhost:11434",
  cloudUrl: "https://ollama.com",
  apiKey: "",
};

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

/**
 * Load configuration from environment variables.
 */
export function loadConfigFromEnv(): Partial<OllamaConfig> {
  const config: Partial<OllamaConfig> = {};
  
  if (process.env.OLLAMA_HOST) {
    config.baseUrl = process.env.OLLAMA_HOST;
  }
  if (process.env.OLLAMA_HOST_CLOUD) {
    config.cloudUrl = process.env.OLLAMA_HOST_CLOUD;
  }
  if (process.env.OLLAMA_API_KEY) {
    config.apiKey = process.env.OLLAMA_API_KEY;
  }
  
  return config;
}

/**
 * Create Ollama clients from config.
 */
export function createClients(config: OllamaConfig): OllamaClients {
  const localClient = new Ollama({ host: config.baseUrl });
  const cloudClient = config.apiKey
    ? new Ollama({ host: config.cloudUrl, headers: { Authorization: `Bearer ${config.apiKey}` } })
    : null;
  
  return { local: localClient, cloud: cloudClient };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if local Ollama is running by attempting to list models.
 */
export async function isLocalRunning(client: Ollama): Promise<boolean> {
  try {
    await client.list();
    return true;
  } catch (err) {
    console.debug(`[pi-ollama] Local Ollama is not reachable: ${err}`);
    return false;
  }
}

/**
 * Get appropriate client for a model (local if available, else cloud).
 */
export function getClientForModel(modelName: string, clients: OllamaClients): Ollama | null {
  if (modelName.includes(':cloud') && clients.cloud) {
    return clients.cloud;
  }
  return clients.local ?? null;
}

export function getModelName(model: string): string {
  return model.replace(':cloud', '');
}

export function stripProviderPrefix(model: string): string {
  if (model.includes('/')) {
    return model.split('/')[1];
  }
  return model;
}

/**
 * Fetch model details from Ollama client.
 */
export async function fetchModelDetails(client: Ollama, modelName: string): Promise<ModelDetails | null> {
  try {
    const info = await client.show({ model: modelName });
    return info as ModelDetails;
  } catch (err) {
    console.debug(`[pi-ollama] Could not fetch details for ${modelName}: ${err}`);
    return null;
  }
}

/**
 * Get context length from model details.
 */
export function getContextLength(modelInfo: ModelDetails | Record<string, unknown> | null, modelName?: string): number {
  if (!modelInfo) {
    if (modelName) return getContextLengthFromName(modelName);
    return 4096;
  }
  
  let info: Record<string, unknown>;
  if ('model_info' in modelInfo && modelInfo.model_info) {
    info = modelInfo.model_info as Record<string, unknown>;
  } else {
    info = modelInfo as Record<string, unknown>;
  }
  
  for (const key of Object.keys(info)) {
    if (key.endsWith('.context_length') && typeof info[key] === 'number') {
      return info[key] as number;
    }
  }
  
  const contextKeys = ['context_length', 'max_position_embeddings', 'max_sequence_length', 'n_ctx'];
  for (const key of contextKeys) {
    if (info[key] && typeof info[key] === 'number') {
      return info[key] as number;
    }
  }
  
  const size = (info['parameter_size'] as string) || '';
  if (size.includes('1B')) return 2048;
  if (size.includes('3B') || size.includes('7B')) return 4096;
  if (size.includes('13B') || size.includes('14B')) return 8192;
  if (size.includes('30B') || size.includes('34B')) return 16384;
  if (size.includes('70B')) return 32768;
  
  if (modelName) return getContextLengthFromName(modelName);
  return 4096;
}

function getContextLengthFromName(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('llama3.2') || lower.includes('llama3.3') || lower.includes('llama3.1')) return 128000;
  if (lower.includes('llama3')) return 8192;
  if (lower.includes('mistral') || lower.includes('mixtral')) return 32768;
  if (lower.includes('qwen3')) return 262144;
  if (lower.includes('qwen2.5') || lower.includes('qwen')) return 32768;
  if (lower.includes('kimi')) return 262144;
  if (lower.includes('minimax')) return 204800;
  if (lower.includes('glm')) return 202752;
  if (lower.includes('gpt-oss')) return 128000;
  return 4096;
}

export function hasVisionCapability(modelInfo: ModelDetails | null): boolean {
  if (!modelInfo) return false;
  const caps = modelInfo.capabilities || [];
  if (caps.some(cap => cap.toLowerCase().includes('vision') || cap.toLowerCase().includes('image'))) {
    return true;
  }
  if (modelInfo.model_info) {
    const info = modelInfo.model_info as Record<string, unknown>;
    if (info['clip.has_vision_encoder'] === true) return true;
    const arch = info['general.architecture'] as string;
    if (arch) {
      const visionArchs = ['llava', 'bakllava', 'moondream', 'llava-next'];
      if (visionArchs.some(va => arch.toLowerCase().includes(va))) return true;
    }
  }
  return false;
}

export function hasReasoningCapability(modelName: string): boolean {
  const lowerName = modelName.toLowerCase();
  return lowerName.includes('reason') || lowerName.includes('r1') || lowerName.includes('instruct') || 
         lowerName.includes('chat') || lowerName.includes('coder') || lowerName.includes('code') || 
         lowerName.includes('deepseek') || lowerName.includes('kimi') || lowerName.includes('phi') || 
         lowerName.includes('qwq');
}

export async function listAllModels(state: OllamaExtensionState): Promise<Array<ModelDetails & { name: string }>> {
  const allModels: Array<ModelDetails & { name: string }> = [];
  const { clients, config } = state;
  
  try {
    if (clients.local) {
      try {
        const localResponse = await clients.local.list();
        const localModels = localResponse.models || [];
        for (const model of localModels) {
          allModels.push({ ...model, name: model.name } as ModelDetails & { name: string });
        }
      } catch (err) {
        console.warn('[shared] Failed to list local models:', err);
      }
    }
    
    if (clients.cloud && config.apiKey) {
      try {
        const cloudResponse = await clients.cloud.list();
        const cloudModels = cloudResponse.models || [];
        for (const model of cloudModels) {
          const existsLocally = allModels.some(m => m.name === model.name && !model.name.includes(':cloud'));
          if (!existsLocally) {
            allModels.push({ ...model, name: model.name } as ModelDetails & { name: string });
          }
        }
      } catch (err) {
        console.warn('[shared] Failed to list cloud models:', err);
      }
    }
  } catch (err) {
    console.error('[shared] Error listing models:', err);
  }
  
  return allModels;
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
  signal?: AbortSignal;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatResult {
  content: string;
  usage: ChatUsage;
}

export async function chat(
  client: { baseUrl: string; apiKey?: string },
  options: ChatOptions
): Promise<ChatResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (client.apiKey) headers['Authorization'] = `Bearer ${client.apiKey}`;

  const response = await fetch(`${client.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    signal: options.signal,
    body: JSON.stringify({
      model: stripProviderPrefix(options.model),
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new Error(`Ollama chat error: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

export async function* chatStream(
  client: { baseUrl: string; apiKey?: string },
  options: ChatOptions
): AsyncGenerator<string, void, unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (client.apiKey) headers['Authorization'] = `Bearer ${client.apiKey}`;

  const response = await fetch(`${client.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    signal: options.signal,
    body: JSON.stringify({
      model: stripProviderPrefix(options.model),
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new Error(`Ollama stream error: ${error}`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const dataLine = line.startsWith('data: ') ? line.slice(6) : line;
        if (dataLine === '[DONE]') continue;
        try {
          const data = JSON.parse(dataLine);
          const content = data.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch (err) {
          console.debug(`[pi-ollama] Stream parse error: ${err}`);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
