/**
 * Shared Ollama Utilities - OpenAI Compatible
 *
 * DRY: Shared between pi-ollama extension and internal app usage
 * Uses OpenAI-compatible endpoints (/v1) for pi-coding-agent compatibility
 */
export interface OllamaConfig {
    baseUrl: string;
    cloudUrl: string;
    apiKey: string | undefined;
}
export declare const DEFAULT_CONFIG: OllamaConfig;
/**
 * Load config from environment variables
 */
export declare function loadConfigFromEnv(): Partial<OllamaConfig>;
export interface OllamaClients {
    local: {
        baseUrl: string;
        apiKey?: string;
    };
    cloud: {
        baseUrl: string;
        apiKey?: string;
    } | null;
    hasApiKey: boolean;
}
/**
 * Create Ollama clients based on config
 * Returns config objects for fetch-based API calls
 */
export declare function createClients(config?: Partial<OllamaConfig>): OllamaClients;
/**
 * Detect if local Ollama is running
 */
export declare function isLocalRunning(client: {
    baseUrl: string;
}): Promise<boolean>;
/**
 * Get the appropriate client for a model
 * Cloud models have :cloud suffix
 */
export declare function getClientForModel(modelId: string, clients: OllamaClients, cloudOnly?: boolean): {
    client: {
        baseUrl: string;
        apiKey?: string;
    };
    isCloud: boolean;
};
/**
 * Strip cloud suffix from model name
 */
export declare function getModelName(modelId: string): string;
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
 * Fetch detailed model info from Ollama's /api/show
 * Note: This is Ollama-specific, not OpenAI-compatible
 */
export declare function fetchModelDetails(client: {
    baseUrl: string;
    apiKey?: string;
}, modelName: string): Promise<ModelDetails | null>;
/**
 * Extract context length from model info
 * Optionally accepts model name for fallback detection
 */
export declare function getContextLength(modelInfo: Record<string, any> | undefined, modelName?: string): number;
/**
 * Check if model has vision capability
 * Checks capabilities array and model_info for vision indicators
 */
export declare function hasVisionCapability(details: ModelDetails): boolean;
/**
 * Check if model name suggests reasoning capability
 */
export declare function hasReasoningCapability(name: string): boolean;
export interface ListedModel {
    name: string;
    isCloud: boolean;
    details?: ModelDetails;
}
/**
 * List all available models using OpenAI-compatible /v1/models
 */
export declare function listAllModels(clients: OllamaClients): Promise<ListedModel[]>;
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
 * Non-streaming chat completion using OpenAI-compatible endpoint
 */
export declare function chat(client: {
    baseUrl: string;
    apiKey?: string;
}, options: ChatOptions): Promise<ChatResult>;
/**
 * Streaming chat completion using OpenAI-compatible endpoint
 */
export declare function chatStream(client: {
    baseUrl: string;
    apiKey?: string;
}, options: ChatOptions): AsyncGenerator<string, void, unknown>;
//# sourceMappingURL=shared.d.ts.map