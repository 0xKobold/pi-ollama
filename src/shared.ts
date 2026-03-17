/**
 * Shared Ollama Utilities - Official Ollama Client Approach
 *
 * Uses the official Ollama JavaScript client for proper cloud/local API handling
 * https://github.com/ollama/ollama-js
 */

import { Ollama } from 'ollama';

// Default config
export interface OllamaConfig {
  baseUrl: string;
  cloudUrl: string;
  apiKey: string;
}

export interface OllamaClients {
  local: Ollama;
  cloud: Ollama | null;
}

export interface ModelDetails {
  model_info?: {
    parameter_size?: string;
    quantization_level?: string;
    // ... other model info fields
  };
  details?: {
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
    // ... other details
  };
  capabilities?: string[];
  // Direct fields (what Ollama actually returns)
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

// Default config
export const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: "http://localhost:11434",
  cloudUrl: "https://ollama.com",
  apiKey: "",
};

// Current config (will be updated by loadConfig)
export let CONFIG: OllamaConfig = { ...DEFAULT_CONFIG };
export let clients: OllamaClients | null = null;

// Load config from environment variables
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

// Load config from pi settings and environment
export function loadConfig(extensionAPI: any): void {
  // Reset to defaults
  CONFIG = { ...DEFAULT_CONFIG };
  
  // Try extension settings first
  const settings = extensionAPI.settings;
  if (settings?.get) {
    CONFIG.baseUrl = settings.get("ollama.baseUrl") ?? CONFIG.baseUrl;
    CONFIG.cloudUrl = settings.get("ollama.cloudUrl") ?? CONFIG.cloudUrl;
    CONFIG.apiKey = settings.get("ollama.apiKey") ?? CONFIG.apiKey;
  }
  
  // Environment override
  CONFIG = { ...CONFIG, ...loadConfigFromEnv() };
  
  // Initialize clients
  clients = createClients(CONFIG);
}

// Create Ollama clients from config
export function createClients(config?: OllamaConfig): OllamaClients {
  const finalConfig = config || DEFAULT_CONFIG;
  const localClient = new Ollama({ host: finalConfig.baseUrl });
  const cloudClient = finalConfig.apiKey
    ? new Ollama({ host: finalConfig.cloudUrl, headers: { Authorization: `Bearer ${finalConfig.apiKey}` } })
    : null;
  
  return { local: localClient, cloud: cloudClient };
}

// Check if local Ollama is running
export function isLocalRunning(client: Ollama): Promise<boolean> {
  return client.list().then(() => true).catch(() => false);
}

// Get appropriate client for a model (local if available, else cloud)
// Note: For simplicity, we check local first. A more sophisticated version
// would check what models are actually available locally vs in cloud
export function getClientForModel(modelName: string, clients: OllamaClients): Ollama | null {
  // For :cloud suffix, use cloud client if available
  if (modelName.includes(':cloud') && clients?.cloud) {
    return clients.cloud;
  }
  // Default to local client
  return clients?.local ?? null;
}

// Get display name for a model
export function getModelName(model: string): string {
  return model.replace(':cloud', '');
}

// Fetch model details from Ollama client
export async function fetchModelDetails(client: Ollama, modelName: string): Promise<ModelDetails | null> {
  try {
    const info = await client.show({ model: modelName });
    return info as ModelDetails;
  } catch {
    return null;
  }
}

// Get context length from model details
// modelInfo can be either:
// - Full ModelDetails object (with model_info nested inside)
// - Just the model_info object (passed directly)
// - null (fallback to name patterns)
export function getContextLength(modelInfo: ModelDetails | Record<string, unknown> | null, modelName?: string): number {
  if (!modelInfo) {
    // Fallback to model name patterns if no model info
    if (modelName) return getContextLengthFromName(modelName);
    return 4096;
  }
  
  // The model_info object from Ollama is a flat Record<string, unknown>
  // It can be passed directly or nested inside a ModelDetails object
  let info: Record<string, unknown>;
  
  // Check if this is a ModelDetails object with nested model_info
  if ('model_info' in modelInfo && modelInfo.model_info) {
    info = modelInfo.model_info as Record<string, unknown>;
  } else {
    // Treat the whole object as the model_info Record directly
    info = modelInfo as Record<string, unknown>;
  }
  
  // Check for architecture-prefixed context_length (e.g., "kimi.context_length", "glm5.context_length")
  for (const key of Object.keys(info)) {
    if (key.endsWith('.context_length') && typeof info[key] === 'number') {
      return info[key] as number;
    }
  }
  
  // Check common context length keys
  const contextKeys = ['context_length', 'max_position_embeddings', 'max_sequence_length', 'n_ctx'];
  for (const key of contextKeys) {
    if (info[key] && typeof info[key] === 'number') {
      return info[key] as number;
    }
  }
  
  // Try to get from direct fields (parameter size mapping)
  const size = (info['parameter_size'] as string) || '';
  if (size.includes('1B')) return 2048;
  if (size.includes('3B') || size.includes('7B')) return 4096;
  if (size.includes('13B') || size.includes('14B')) return 8192;
  if (size.includes('30B') || size.includes('34B')) return 16384;
  if (size.includes('70B')) return 32768;
  
  // Fallback to model name patterns
  if (modelName) return getContextLengthFromName(modelName);
  
  return 4096; // Reasonable default
}

// Get context length from model name (for cloud models without details)
function getContextLengthFromName(name: string): number {
  const lower = name.toLowerCase();
  
  if (lower.includes('llama3.2')) return 128000;
  if (lower.includes('llama3.3')) return 128000;
  if (lower.includes('llama3.1')) return 128000;
  if (lower.includes('llama3')) return 8192;
  if (lower.includes('mistral')) return 32768;
  if (lower.includes('mixtral')) return 32768;
  if (lower.includes('qwen3')) return 262144;      // qwen3.5 has 262k context
  if (lower.includes('qwen2.5')) return 32768;
  if (lower.includes('qwen')) return 32768;
  if (lower.includes('kimi')) return 262144;         // kimi-k2 has 262k context
  if (lower.includes('minimax')) return 204800;    // minimax-m2 has 204k context
  if (lower.includes('glm')) return 202752;        // glm-5 has 202k context
  if (lower.includes('gpt-oss')) return 128000;
  
  // Default conservative value
  return 4096;
}

// Check if model has vision capability
export function hasVisionCapability(modelInfo: ModelDetails | null): boolean {
  if (!modelInfo) return false;

  // Check capabilities array
  const caps = modelInfo.capabilities || [];
  if (caps.some(cap =>
    cap.toLowerCase().includes('vision') ||
    cap.toLowerCase().includes('image')
  )) {
    return true;
  }

  // Check model_info for vision architectures
  if (modelInfo.model_info) {
    const info = modelInfo.model_info as Record<string, unknown>;

    // Check for clip vision encoder
    if (info['clip.has_vision_encoder'] === true) return true;

    // Check architecture for vision models
    const arch = info['general.architecture'] as string;
    if (arch) {
      const visionArchs = ['llava', 'bakllava', 'moondream', 'llava-next'];
      if (visionArchs.some(va => arch.toLowerCase().includes(va))) {
        return true;
      }
    }
  }

  return false;
}

// Check if model has reasoning capability
export function hasReasoningCapability(modelName: string): boolean {
  const lowerName = modelName.toLowerCase();
  // Common indicators of reasoning/instruction models
  return lowerName.includes('reason') ||
         lowerName.includes('r1') ||
         lowerName.includes('instruct') ||
         lowerName.includes('chat') ||
         lowerName.includes('coder') ||      // Code models have strong reasoning
         lowerName.includes('code') ||        // Code models have strong reasoning
         lowerName.includes('deepseek') ||   // DeepSeek models have reasoning
         lowerName.includes('kimi') ||        // Kimi models have reasoning
         lowerName.includes('phi') ||         // Phi models
         lowerName.includes('qwq');           // QwQ reasoning model
}

// List all models from Ollama client
export async function listAllModels(clients: OllamaClients): Promise<Array<ModelDetails & { name: string }>> {
  const allModels: Array<ModelDetails & { name: string }> = [];
  
  try {
    // Get local models
    if (clients?.local) {
      try {
        const localResponse = await clients.local.list();
        const localModels = localResponse.models || [];
        for (const model of localModels) {
          allModels.push({
            ...model,
            name: model.name
          } as ModelDetails & { name: string });
        }
      } catch (err) {
        console.warn('[shared] Failed to list local models:', err);
      }
    }
    
    // Get cloud models (if we have API key)
    if (clients?.cloud && CONFIG.apiKey) {
      try {
        const cloudResponse = await clients.cloud.list();
        const cloudModels = cloudResponse.models || [];
        for (const model of cloudModels) {
          // Avoid adding cloud models that are already available locally
          const existsLocally = allModels.some(m => 
            m.name === model.name && !model.name.includes(':cloud')
          );
          if (!existsLocally) {
            allModels.push({
              ...model,
              name: model.name
            } as ModelDetails & { name: string });
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
}// ============================================================================
// CHAT UTILITIES (OpenAI-compatible /v1/chat/completions)
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
  client: { baseUrl: string; apiKey?: string },
  options: ChatOptions
): Promise<ChatResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (client.apiKey) {
    headers['Authorization'] = `Bearer ${client.apiKey}`;
  }

  const response = await fetch(`${client.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.model,
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

/**
 * Streaming chat completion
 */
export async function* chatStream(
  client: { baseUrl: string; apiKey?: string },
  options: ChatOptions
): AsyncGenerator<string, void, unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (client.apiKey) {
    headers['Authorization'] = `Bearer ${client.apiKey}`;
  }

  const response = await fetch(`${client.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.model,
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

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        // Skip SSE prefix
        const dataLine = line.startsWith('data: ') ? line.slice(6) : line;
        if (dataLine === '[DONE]') continue;

        try {
          const data = JSON.parse(dataLine);
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}