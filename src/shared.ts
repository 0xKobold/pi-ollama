/**
 * Shared Ollama Utilities - Official Ollama Client Approach
 *
 * Uses the official Ollama JavaScript client for proper cloud/local API handling
 * https://github.com/ollama/ollama-js
 *
 * Ollama API docs: https://docs.ollama.com/
 * - /api/tags  — List models (GET)
 * - /api/show  — Model details (POST)
 * - /api/chat   — Chat completions (POST, native)
 * - /v1/chat/completions — OpenAI-compatible chat (POST)
 * - /v1/responses — OpenAI-compatible responses (POST)
 *
 * Context length defaults based on Ollama docs:
 * https://docs.ollama.com/context-length
 * - Cloud models use max context by default
 * - Local models scale based on available VRAM
 * - Unknown models: 128k is a better default than 4k
 */

import { Ollama } from 'ollama';
import { Type, Static } from '@sinclair/typebox';

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

/**
 * Model details from Ollama /api/show endpoint.
 * See: https://docs.ollama.com/api-reference/show-model-details
 */
export interface ModelDetails {
  model_info?: Record<string, unknown>;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
  capabilities?: string[];
  parameter_size?: string;
  quantization_level?: string;
  families?: string[];
  modified_at?: string;
}

/**
 * Model entry from Ollama /api/tags endpoint.
 * See: https://docs.ollama.com/api/tags
 */
export interface ListedModel {
  name: string;
  model?: string;
  size?: number;
  modified_at?: string;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

// Default configuration values
export const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: "http://localhost:11434",
  cloudUrl: "https://ollama.com",
  apiKey: "",
};

/** Default request timeout in milliseconds (120s for chat, generous for large models) */
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

/** Default context window for models we can't identify (128k tokens) */
export const DEFAULT_CONTEXT_LENGTH = 131072;

/** Default max output tokens when model details aren't available */
export const DEFAULT_MAX_TOKENS = 8192;

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Base error for Ollama API failures.
 * Classifies errors by HTTP status for intelligent retry routing.
 */
export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

/** Rate-limit exceeded (429) */
export class OllamaRateLimitError extends OllamaError {
  constructor(retryAfter?: number, body?: string) {
    super(`Rate limit exceeded${retryAfter ? ` (retry after ${retryAfter}s)` : ''}`, 429, body);
    this.name = 'OllamaRateLimitError';
  }
}

/** Authentication failure (401/403) */
export class OllamaAuthError extends OllamaError {
  constructor(body?: string) {
    super('Authentication failed — check your API key', 401, body);
    this.name = 'OllamaAuthError';
  }
}

/** Model not found or context overflow (404/400) */
export class OllamaModelError extends OllamaError {
  constructor(message: string, statusCode: number, body?: string) {
    super(message, statusCode, body);
    this.name = 'OllamaModelError';
  }
}

/** Server-side error (500/502) */
export class OllamaServerError extends OllamaError {
  constructor(statusCode: number, body?: string) {
    super(`Ollama server error (${statusCode})`, statusCode, body);
    this.name = 'OllamaServerError';
  }
}

/**
 * Classify an HTTP error response into a typed OllamaError.
 */
export function classifyHttpError(status: number, body: string): OllamaError {
  switch (status) {
    case 401:
    case 403:
      return new OllamaAuthError(body);
    case 429:
      return new OllamaRateLimitError(undefined, body);
    case 404:
      return new OllamaModelError(body || 'Model not found', status, body);
    case 400:
      return new OllamaModelError(body || 'Bad request — possible context overflow', status, body);
    default:
      if (status >= 500) return new OllamaServerError(status, body);
      return new OllamaError(`Ollama error (${status}): ${body}`, status, body);
  }
}

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

/**
 * Load configuration from environment variables.
 * See: https://docs.ollama.com/api/authentication
 *
 * OLLAMA_HOST — local base URL
 * OLLAMA_HOST_CLOUD — cloud base URL
 * OLLAMA_API_KEY — cloud API key
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
 * Load config from pi settings files.
 * Project settings override global settings when present.
 */
export async function loadConfigFromSettingsFiles(): Promise<Partial<OllamaConfig>> {
  // Dynamic imports to work in ESM environments (Cloudflare Workers, Deno)
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');

  const readSettings = (filePath: string): Record<string, unknown> => {
    try {
      if (!fs.existsSync(filePath)) return {};
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const globalSettingsPath = path.join(os.homedir(), '.pi', 'agent', 'settings.json');
  const projectSettingsPath = path.join(process.cwd(), '.pi', 'settings.json');

  const globalSettings = readSettings(globalSettingsPath);
  const projectSettings = readSettings(projectSettingsPath);

  const globalOllama = globalSettings.ollama && typeof globalSettings.ollama === 'object' ? globalSettings.ollama as Record<string, unknown> : {};
  const projectOllama = projectSettings.ollama && typeof projectSettings.ollama === 'object' ? projectSettings.ollama as Record<string, unknown> : {};
  const merged = { ...globalOllama, ...projectOllama };

  return {
    baseUrl: typeof merged.baseUrl === 'string' ? merged.baseUrl : undefined,
    cloudUrl: typeof merged.cloudUrl === 'string' ? merged.cloudUrl : undefined,
    apiKey: typeof merged.apiKey === 'string' ? merged.apiKey : undefined,
  };
}

/**
 * Create Ollama clients from config.
 * See: https://docs.ollama.com/cloud
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
 * Get appropriate client for a model (cloud if :cloud suffix, else local).
 */
export function getClientForModel(modelName: string, clients: OllamaClients): Ollama | null {
  if (modelName.includes(':cloud') && clients.cloud) {
    return clients.cloud;
  }
  return clients.local ?? null;
}

/**
 * Strip the :cloud suffix from a model name.
 * e.g. "llama3:cloud" → "llama3"
 */
export function getModelName(model: string): string {
  return model.replace(':cloud', '');
}

/**
 * Strip any provider prefix like "ollama/" from a model name.
 * e.g. "ollama/llama3" → "llama3"
 */
export function stripProviderPrefix(model: string): string {
  if (model.includes('/')) {
    return model.split('/')[1];
  }
  return model;
}

/**
 * Fetch model details from Ollama /api/show endpoint.
 * See: https://docs.ollama.com/api-reference/show-model-details
 */
export async function fetchModelDetails(client: Ollama, modelName: string): Promise<ModelDetails | null> {
  try {
    const info = await client.show({ model: modelName });
    return info as unknown as ModelDetails;
  } catch (err) {
    console.debug(`[pi-ollama] Could not fetch details for ${modelName}: ${err}`);
    return null;
  }
}

// ============================================================================
// CONTEXT LENGTH DETECTION
// ============================================================================

/**
 * Get context length from model details.
 *
 * Resolution order:
 * 1. model_info.*.context_length (from /api/show)
 * 2. Top-level context_length / max_position_embeddings / max_sequence_length / n_ctx
 * 3. Parameter-size heuristic
 * 4. Name-based lookup (getContextLengthFromName)
 * 5. Default fallback (128k)
 *
 * See: https://docs.ollama.com/context-length
 */
export function getContextLength(modelInfo: ModelDetails | Record<string, unknown> | null, modelName?: string): number {
  if (!modelInfo) {
    if (modelName) return getContextLengthFromName(modelName);
    return DEFAULT_CONTEXT_LENGTH;
  }

  let info: Record<string, unknown>;
  if ('model_info' in modelInfo && modelInfo.model_info) {
    info = modelInfo.model_info as Record<string, unknown>;
  } else {
    info = modelInfo as Record<string, unknown>;
  }

  // 1. Architecture-specific context_length (e.g., "gemma3.context_length")
  for (const key of Object.keys(info)) {
    if (key.endsWith('.context_length') && typeof info[key] === 'number') {
      return info[key] as number;
    }
  }

  // 2. Generic context keys
  const contextKeys = ['context_length', 'max_position_embeddings', 'max_sequence_length', 'n_ctx'];
  for (const key of contextKeys) {
    if (info[key] && typeof info[key] === 'number') {
      return info[key] as number;
    }
  }

  // 3. Parameter-size heuristic
  const size = (info['parameter_size'] as string) || (info['details'] as Record<string, unknown>)?.['parameter_size'] as string || '';
  if (size.includes('1B')) return 2048;
  if (size.includes('3B') || size.includes('7B')) return 4096;
  if (size.includes('13B') || size.includes('14B')) return 8192;
  if (size.includes('30B') || size.includes('34B')) return 16384;
  if (size.includes('70B')) return 32768;

  // 4. Name-based lookup
  if (modelName) return getContextLengthFromName(modelName);

  // 5. Default fallback — 128k
  return DEFAULT_CONTEXT_LENGTH;
}

/**
 * Infer context window from model name when /api/show isn't available
 * (e.g., cloud models).
 *
 * Based on Ollama model library data as of 2025-05.
 * See: https://ollama.com/search
 */
function getContextLengthFromName(name: string): number {
  const lower = name.toLowerCase();

  // --- High-context models (sorted by specificity) ---
  if (lower.includes('deepseek-v4')) return 1048576;   // 1M tokens
  if (lower.includes('kimi')) return 262144;            // 256k tokens
  if (lower.includes('qwen3')) return 262144;            // 256k tokens
  if (lower.includes('minimax')) return 204800;          // 200k tokens
  if (lower.includes('glm')) return 202752;              // ~198k tokens

  // --- 128k+ models ---
  if (lower.includes('llama3.2') || lower.includes('llama3.3') || lower.includes('llama3.1')) return 128000;
  if (lower.includes('deepseek')) return 163840;         // 160k tokens (deepseek-v3, deepseek-r1, etc.)
  if (lower.includes('gpt-oss')) return 128000;

  // --- 32k models ---
  if (lower.includes('qwen2.5') || lower.includes('qwen')) return 32768;
  if (lower.includes('mistral') || lower.includes('mixtral')) return 32768;

  // --- Smaller context models ---
  if (lower.includes('llama3')) return 8192;

  // Default: 128k — per https://docs.ollama.com/context-length
  // Cloud models default to max; 128k is a conservative floor for unknowns
  return DEFAULT_CONTEXT_LENGTH;
}

// ============================================================================
// CAPABILITY DETECTION
// ============================================================================

/**
 * Detect vision capability from model details.
 *
 * Checks, in order:
 * 1. capabilities array (from /api/show) — "vision" or "image"
 * 2. model_info.clip.has_vision_encoder flag
 * 3. Architecture name (llava, moondream, etc.)
 *
 * See: https://docs.ollama.com/capabilities/vision
 */
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

/**
 * Detect reasoning/thinking capability.
 *
 * Ollama's /api/show returns a "thinking" or "reason" capability for models
 * that support separate thinking traces. We check that first, then fall back
 * to name-based heuristics for cloud models where /api/show isn't available.
 *
 * IMPORTANT: "instruct", "chat", and "code" are NOT reasoning capabilities —
 * they indicate instruction-following format, not extended thinking.
 *
 * See: https://docs.ollama.com/capabilities/thinking
 */
export function hasReasoningCapability(modelName: string, modelInfo?: ModelDetails | null): boolean {
  // 1. Check capabilities from /api/show
  if (modelInfo?.capabilities?.length) {
    const caps = modelInfo.capabilities.map(c => c.toLowerCase());
    if (caps.includes('thinking') || caps.includes('reason')) {
      return true;
    }
  }

  // 2. Name-based heuristic for cloud models (no /api/show available)
  const lowerName = modelName.toLowerCase();
  // Models with dedicated thinking/reasoning mode
  if (lowerName.includes('reason')) return true;
  if (lowerName.match(/\br1\b/)) return true;               // DeepSeek-R1, etc.
  if (lowerName.includes('qwq')) return true;                // QwQ reasoning
  if (lowerName.includes('deepseek')) return true;           // DeepSeek models have think mode
  if (lowerName.includes('gpt-oss')) return true;            // GPT-OSS has think levels
  if (lowerName.includes('phi')) return true;                // Phi models

  return false;
}

// ============================================================================
// MODEL LISTING
// ============================================================================

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
          // Deduplicate: if same model exists locally, skip the cloud version
          const localName = getModelName(model.name);
          const existsLocally = allModels.some(m => getModelName(m.name) === localName);
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
  /** Max output tokens. Defaults to model's context window or DEFAULT_MAX_TOKENS */
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
  /** Request timeout in ms. Default: 120s */
  timeoutMs?: number;
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
 * Send a non-streaming chat request via Ollama's OpenAI-compatible endpoint.
 * See: https://docs.ollama.com/api/openai-compatibility
 */
export async function chat(
  client: { baseUrl: string; apiKey?: string },
  options: ChatOptions
): Promise<ChatResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (client.apiKey) headers['Authorization'] = `Bearer ${client.apiKey}`;

  // Apply timeout via AbortController
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Merge external signal with our timeout signal
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  try {
    const body: Record<string, unknown> = {
      model: stripProviderPrefix(options.model),
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      stream: false,
    };

    // Only include max_tokens if explicitly set — let the API use its default otherwise
    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    const response = await fetch(`${client.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      throw classifyHttpError(response.status, errorBody);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Stream chat tokens via Ollama's OpenAI-compatible endpoint.
 * See: https://docs.ollama.com/api/streaming
 *
 * Parses SSE format: lines starting with "data: " followed by JSON,
 * terminated by "data: [DONE]".
 */
export async function* chatStream(
  client: { baseUrl: string; apiKey?: string },
  options: ChatOptions
): AsyncGenerator<string, void, unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (client.apiKey) headers['Authorization'] = `Bearer ${client.apiKey}`;

  // Apply timeout for initial connection; streaming reads have no timeout
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  try {
    const body: Record<string, unknown> = {
      model: stripProviderPrefix(options.model),
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      stream: true,
    };

    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    const response = await fetch(`${client.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify(body),
    });

    // Clear connection timeout — streaming takes longer
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      throw classifyHttpError(response.status, errorBody);
    }

    if (!response.body) throw new OllamaError('No response body from streaming endpoint');

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
          } catch {
            // Partial JSON chunks are normal in SSE — skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timeoutId);
  }
}