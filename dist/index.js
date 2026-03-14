/**
 * Pi Ollama Extension - Using Shared Utilities
 *
 * Uses OpenAI-compatible endpoints via shared.ts for pi-coding-agent compatibility
 */
import { loadConfigFromEnv, createClients, isLocalRunning, fetchModelDetails, getContextLength, hasVisionCapability, hasReasoningCapability, listAllModels, } from './shared.js';
// Re-export shared utilities for consumers
export { loadConfigFromEnv, createClients, isLocalRunning, getClientForModel, getModelName, fetchModelDetails, getContextLength, hasVisionCapability, hasReasoningCapability, listAllModels, chat, chatStream, } from './shared.js';
// Default config
const DEFAULT_CONFIG = {
    baseUrl: "http://localhost:11434",
    cloudUrl: "https://ollama.com",
    apiKey: undefined,
};
let CONFIG = { ...DEFAULT_CONFIG };
let clients = null;
// Load from pi settings and env
function loadConfig(pi) {
    // Reset to defaults first
    CONFIG = { ...DEFAULT_CONFIG };
    // Try pi.settings first
    const settings = pi.settings;
    if (settings?.get) {
        const baseUrl = settings.get("ollama.baseUrl");
        const apiKey = settings.get("ollama.apiKey");
        // Only override if value is actually set (not undefined/null)
        if (baseUrl != null)
            CONFIG.baseUrl = baseUrl;
        if (apiKey != null)
            CONFIG.apiKey = apiKey;
    }
    // Environment override (runtime)
    if (typeof process !== 'undefined') {
        const envConfig = loadConfigFromEnv();
        if (envConfig.baseUrl)
            CONFIG.baseUrl = envConfig.baseUrl;
        if (envConfig.cloudUrl)
            CONFIG.cloudUrl = envConfig.cloudUrl;
        if (envConfig.apiKey)
            CONFIG.apiKey = envConfig.apiKey;
    }
    // Initialize clients
    clients = createClients(CONFIG);
    console.log(`[pi-ollama] Config: baseUrl=${CONFIG.baseUrl}, cloudUrl=${CONFIG.cloudUrl}, hasApiKey=${!!CONFIG.apiKey}`);
}
// ============================================================================
// MODEL CREATION
// ============================================================================
function createModel(name, isCloud, details) {
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
async function fetchLocalModels() {
    if (!clients)
        return [];
    try {
        const models = await listAllModels(clients);
        return models
            .filter(m => !m.isCloud)
            .map(m => createModel(m.name, false, m.details));
    }
    catch (err) {
        console.log(`[pi-ollama] Error fetching local models: ${err}`);
        return [];
    }
}
async function fetchCloudModels() {
    if (!clients?.hasApiKey)
        return [];
    try {
        const models = await listAllModels(clients);
        return models
            .filter(m => m.isCloud)
            .map(m => createModel(m.name.replace(':cloud', ''), true, m.details));
    }
    catch {
        // Return default cloud models if fetch fails
        return [
            'kimi-k2.5',
            'llama3.3',
            'qwen2.5',
            'mistral',
            'codellama',
            'deepseek-r1',
            'gemma2',
        ].map(name => createModel(name, true));
    }
}
// ============================================================================
// COMMANDS
// ============================================================================
async function handleStatus(ctx) {
    if (!clients) {
        ctx.ui?.notify?.('Ollama not initialized', 'error');
        return;
    }
    const hasLocal = await isLocalRunning(clients.local);
    const lines = [
        '🦙 Ollama Status',
        '',
        `Local: ${hasLocal ? '✅ Connected' : '❌ Not running'}`,
        `Cloud: ${clients.hasApiKey ? '✅ API key set' : '❌ No API key'}`,
        '',
        `Base URL: ${CONFIG.baseUrl}`,
        `Cloud URL: ${CONFIG.cloudUrl}`,
    ];
    ctx.ui?.notify?.(lines.join('\n'), 'info');
}
async function handleModelInfo(args, ctx) {
    const modelName = args.trim();
    if (!modelName) {
        ctx.ui?.notify?.('Usage: /ollama-info MODEL_NAME', 'error');
        return;
    }
    if (!clients) {
        ctx.ui?.notify?.('Ollama not initialized', 'error');
        return;
    }
    let details = null;
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
    const contextLength = getContextLength(details.model_info);
    const isVision = hasVisionCapability(details);
    const paramSize = details.details?.parameter_size || 'Unknown';
    const family = details.details?.family || 'Unknown';
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
async function handleModels(pi, ctx) {
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
    // Register provider with /v1 for OpenAI compatibility
    const effectiveApiKey = CONFIG.apiKey || 'ollama-local';
    const allModels = [...localModels, ...cloudModels];
    if (allModels.length > 0) {
        console.log(`[pi-ollama] Registering ${localModels.length} local, ${cloudModels.length} cloud models`);
        pi.registerProvider('ollama', {
            baseUrl: `${CONFIG.baseUrl}/v1`,
            apiKey: effectiveApiKey,
            api: 'openai-completions',
            models: allModels,
        });
    }
}
// ============================================================================
// EXTENSION EXPORT
// ============================================================================
export default async function ollamaExtension(pi) {
    loadConfig(pi);
    pi.registerCommand('ollama-status', {
        description: 'Check Ollama connection status',
        handler: async (_args, ctx) => handleStatus(ctx),
    });
    pi.registerCommand('ollama-info', {
        description: 'Show model details',
        handler: async (args, ctx) => handleModelInfo(args, ctx),
    });
    pi.registerCommand('ollama-models', {
        description: 'List available models',
        handler: async (_args, ctx) => handleModels(pi, ctx),
    });
    pi.registerCommand('ollama', {
        description: 'Ollama management',
        handler: async (args, ctx) => {
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
    // Register models on startup
    console.log('[pi-ollama] Fetching models...');
    try {
        await handleModels(pi, { ui: { notify: () => { } } });
    }
    catch (err) {
        console.error('[pi-ollama] Error fetching models:', err);
    }
    console.log('[pi-ollama] Extension loaded');
}
//# sourceMappingURL=index.js.map