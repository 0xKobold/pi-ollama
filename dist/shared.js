/**
 * Shared Ollama Utilities - OpenAI Compatible
 *
 * DRY: Shared between pi-ollama extension and internal app usage
 * Uses OpenAI-compatible endpoints (/v1) for pi-coding-agent compatibility
 */
export const DEFAULT_CONFIG = {
    baseUrl: 'http://localhost:11434',
    cloudUrl: 'https://ollama.com',
    apiKey: undefined,
};
/**
 * Load config from environment variables
 */
export function loadConfigFromEnv() {
    return {
        baseUrl: process.env.OLLAMA_BASE_URL,
        cloudUrl: process.env.OLLAMA_CLOUD_URL,
        apiKey: process.env.OLLAMA_API_KEY,
    };
}
/**
 * Load config from pi settings files.
 * Project settings override global settings when present.
 */
export function loadConfigFromSettingsFiles() {
    if (typeof process === 'undefined')
        return {};
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const readSettings = (filePath) => {
        try {
            if (!fs.existsSync(filePath))
                return {};
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        }
        catch {
            return {};
        }
    };
    const globalSettingsPath = path.join(os.homedir(), '.pi', 'agent', 'settings.json');
    const projectSettingsPath = path.join(process.cwd(), '.pi', 'settings.json');
    const globalSettings = readSettings(globalSettingsPath);
    const projectSettings = readSettings(projectSettingsPath);
    const globalOllama = globalSettings.ollama && typeof globalSettings.ollama === 'object' ? globalSettings.ollama : {};
    const projectOllama = projectSettings.ollama && typeof projectSettings.ollama === 'object' ? projectSettings.ollama : {};
    const merged = { ...globalOllama, ...projectOllama };
    return {
        baseUrl: typeof merged.baseUrl === 'string' ? merged.baseUrl : undefined,
        cloudUrl: typeof merged.cloudUrl === 'string' ? merged.cloudUrl : undefined,
        apiKey: typeof merged.apiKey === 'string' ? merged.apiKey : undefined,
    };
}
/**
 * Create Ollama clients based on config
 * Returns config objects for fetch-based API calls
 */
export function createClients(config = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    const local = {
        baseUrl: merged.baseUrl.replace(/\/$/, ''), // Remove trailing slash
        apiKey: undefined,
    };
    const cloud = merged.apiKey
        ? {
            baseUrl: merged.cloudUrl.replace(/\/$/, ''),
            apiKey: merged.apiKey,
        }
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
export async function isLocalRunning(client) {
    try {
        const res = await fetch(`${client.baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(2000),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
/**
 * Get the appropriate client for a model
 * Cloud models have :cloud suffix
 */
export function getClientForModel(modelId, clients, cloudOnly = false) {
    const isCloudModel = modelId.includes(':cloud');
    if ((isCloudModel || cloudOnly) && clients.cloud) {
        return { client: clients.cloud, isCloud: true };
    }
    return { client: clients.local, isCloud: false };
}
/**
 * Strip cloud suffix from model name
 */
export function getModelName(modelId) {
    return modelId.replace(':cloud', '');
}
/**
 * Fetch detailed model info from Ollama's /api/show
 * Note: This is Ollama-specific, not OpenAI-compatible
 */
export async function fetchModelDetails(client, modelName) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (client.apiKey) {
            headers['Authorization'] = `Bearer ${client.apiKey}`;
        }
        const res = await fetch(`${client.baseUrl}/api/show`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: modelName }),
        });
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch {
        return null;
    }
}
/**
 * Extract context length from model info
 * Optionally accepts model name for fallback detection
 */
export function getContextLength(modelInfo, modelName) {
    // Try to get from model_info first
    if (modelInfo) {
        const keys = Object.keys(modelInfo);
        for (const key of keys) {
            if (key.endsWith('.context_length') && typeof modelInfo[key] === 'number') {
                return modelInfo[key];
            }
        }
    }
    // Fallback: detect from model name
    if (modelName) {
        const lower = modelName.toLowerCase();
        // Kimi models typically have 256k context
        if (lower.includes('kimi'))
            return 256000;
        // Minimax models
        if (lower.includes('minimax'))
            return 256000;
    }
    return 128000;
}
/**
 * Check if model has vision capability
 * Checks capabilities array and model_info for vision indicators
 */
export function hasVisionCapability(details) {
    // Check capabilities array
    if (details.capabilities?.includes('vision'))
        return true;
    if (details.capabilities?.includes('image'))
        return true;
    // Check model_info for vision indicators
    if (details.model_info) {
        // CLIP vision encoder indicates vision capability
        if (details.model_info['clip.has_vision_encoder'] === true)
            return true;
        // Vision-specific architectures
        const arch = details.model_info['general.architecture'];
        if (arch && ['llava', 'bakllava', 'moondream'].some(a => arch.toLowerCase().includes(a))) {
            return true;
        }
    }
    return false;
}
/**
 * Check if model name suggests reasoning capability
 */
export function hasReasoningCapability(name) {
    const lower = name.toLowerCase();
    return ['coder', 'code', 'r1', 'deepseek', 'kimi', 'think', 'reason'].some((k) => lower.includes(k));
}
/**
 * List all available models using OpenAI-compatible /v1/models
 */
export async function listAllModels(clients) {
    const models = [];
    // Try local first using OpenAI endpoint
    try {
        const res = await fetch(`${clients.local.baseUrl}/v1/models`);
        if (res.ok) {
            const data = await res.json();
            for (const m of data.data || []) {
                // Get detailed info using Ollama-specific endpoint
                const details = await fetchModelDetails(clients.local, m.id);
                models.push({
                    name: m.id,
                    isCloud: false,
                    details: details || undefined,
                });
            }
        }
    }
    catch {
        // Fallback to Ollama-native endpoint
        try {
            const res = await fetch(`${clients.local.baseUrl}/api/tags`);
            if (res.ok) {
                const data = await res.json();
                for (const m of data.models || []) {
                    const details = await fetchModelDetails(clients.local, m.name);
                    models.push({
                        name: m.name,
                        isCloud: false,
                        details: details || undefined,
                    });
                }
            }
        }
        catch {
            // Local not available
        }
    }
    // Try cloud if we have API key
    if (clients.cloud) {
        try {
            const headers = {};
            if (clients.cloud.apiKey) {
                headers['Authorization'] = `Bearer ${clients.cloud.apiKey}`;
            }
            const res = await fetch(`${clients.cloud.baseUrl}/v1/models`, { headers });
            if (res.ok) {
                const data = await res.json();
                for (const m of data.data || []) {
                    // Skip if already have locally
                    if (models.some((lm) => lm.name === m.id))
                        continue;
                    const details = await fetchModelDetails(clients.cloud, m.id);
                    models.push({
                        name: `${m.id}:cloud`,
                        isCloud: true,
                        details: details || undefined,
                    });
                }
            }
        }
        catch {
            // Cloud not available
        }
    }
    return models;
}
/**
 * Non-streaming chat completion using OpenAI-compatible endpoint
 */
export async function chat(client, options) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (client.apiKey) {
        headers['Authorization'] = `Bearer ${client.apiKey}`;
    }
    const res = await fetch(`${client.baseUrl}/v1/chat/completions`, {
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
    if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(`Ollama chat error: ${err}`);
    }
    const data = await res.json();
    return {
        content: data.choices?.[0]?.message?.content ?? '',
        usage: {
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
        },
    };
}
/**
 * Streaming chat completion using OpenAI-compatible endpoint
 */
export async function* chatStream(client, options) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (client.apiKey) {
        headers['Authorization'] = `Bearer ${client.apiKey}`;
    }
    const res = await fetch(`${client.baseUrl}/v1/chat/completions`, {
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
    if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(`Ollama stream error: ${err}`);
    }
    if (!res.body) {
        throw new Error('No response body');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter((line) => line.trim());
            for (const line of lines) {
                // Skip SSE prefix
                const dataLine = line.startsWith('data: ') ? line.slice(6) : line;
                if (dataLine === '[DONE]')
                    continue;
                try {
                    const data = JSON.parse(dataLine);
                    const content = data.choices?.[0]?.delta?.content;
                    if (content) {
                        yield content;
                    }
                }
                catch {
                    // Ignore parse errors
                }
            }
        }
    }
    finally {
        reader.releaseLock();
    }
}
//# sourceMappingURL=shared.js.map