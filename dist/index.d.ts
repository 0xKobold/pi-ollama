/**
 * Pi Ollama Extension - Using Shared Utilities
 *
 * Uses OpenAI-compatible endpoints via shared.ts for pi-coding-agent compatibility
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
export { loadConfigFromEnv, loadConfigFromSettingsFiles, createClients, isLocalRunning, getClientForModel, getModelName, fetchModelDetails, getContextLength, hasVisionCapability, hasReasoningCapability, listAllModels, chat, chatStream, type OllamaConfig, type OllamaClients, type ModelDetails, type ListedModel, type ChatMessage, type ChatOptions, type ChatUsage, type ChatResult, } from './shared.js';
export default function ollamaExtension(pi: ExtensionAPI): Promise<void>;
//# sourceMappingURL=index.d.ts.map