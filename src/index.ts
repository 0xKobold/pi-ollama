/**
 * Pi Ollama Extension
 * 
 * Unified local + cloud Ollama support for pi-coding-agent
 * 
 * Installation:
 *   pi install npm:@0xkobold/pi-ollama
 * 
 * Or in pi-config.ts:
 *   extensions: ['npm:@0xkobold/pi-ollama']
 * 
 * Features:
 * - Local Ollama (localhost:11434)
 * - Ollama Cloud (ollama.com) with API key
 * - Model management via /ollama commands
 * - Web search via Ollama Cloud
 * 
 * @see https://ollama.com
 * @see https://github.com/0xKobold/pi-ollama
 */

import type { ExtensionAPI, ProviderModelConfig } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ============================================================================
// CONFIGURATION
// ============================================================================

interface OllamaConfig {
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  customModels?: string[];
}

// Default config (can be overridden via pi settings)
let CONFIG: OllamaConfig = {
  baseUrl: "http://localhost:11434",
  apiKey: "",
  defaultModel: "",
  customModels: [],
};

// Load from pi settings if available
function loadConfig(pi: ExtensionAPI): void {
  const settings = (pi as any).settings;
  if (settings) {
    CONFIG.baseUrl = settings.get?.("ollama.baseUrl") || CONFIG.baseUrl;
    CONFIG.apiKey = settings.get?.("ollama.apiKey") || CONFIG.apiKey;
    CONFIG.defaultModel = settings.get?.("ollama.defaultModel") || CONFIG.defaultModel;
    CONFIG.customModels = settings.get?.("ollama.customModels") || CONFIG.customModels;
  }
}

const LOCAL_URL = "http://localhost:11434";
const CLOUD_URL = "https://ollama.com";

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function testLocalConnection(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${LOCAL_URL}/api/tags`, {}, 2000);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// MODEL FACTORY
// ============================================================================

function createModel(name: string, prefix: string, options: { label?: string; isCloud?: boolean } = {}): ProviderModelConfig {
  const { label = "", isCloud = false } = options;
  const displayName = label ? `${name} (${label})` : name;
  
  const lowerName = name.toLowerCase();
  
  const isReasoning = ["coder", "r1", "deepseek", "kimi", "think", "reason"].some(kw => 
    lowerName.includes(kw)
  );
  
  const isVision = ["vision", "vl", "multimodal", "llava", "bakllava", "moondream"].some(kw =>
    lowerName.includes(kw)
  );

  const modelId = isCloud ? `${name}:cloud` : name;
  const inputTypes: ("text" | "image")[] = isVision ? ["text", "image"] : ["text"];
  
  const visionLabel = isVision ? "👁️ " : "";
  const cloudLabel = isCloud ? "☁️ " : "";

  return {
    id: modelId,
    name: `${cloudLabel}${visionLabel}${displayName}`,
    api: "openai-completions",
    reasoning: isReasoning,
    input: inputTypes,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
    provider: prefix,
  };
}

// ============================================================================
// MODEL FETCHING
// ============================================================================

async function fetchLocalModels(): Promise<ProviderModelConfig[]> {
  try {
    const response = await fetchWithTimeout(`${LOCAL_URL}/api/tags`, {}, 5000);
    const data = await response.json() as { models: Array<{ name: string; size?: number }> };
    
    return data.models.map(m => createModel(m.name, "ollama", { 
      label: formatSize(m.size || 0) 
    }));
  } catch {
    return [];
  }
}

async function fetchCloudModels(apiKey: string): Promise<ProviderModelConfig[]> {
  if (!apiKey) return [];
  
  try {
    const response = await fetchWithTimeout(`${CLOUD_URL}/api/tags`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }, 5000);
    
    const data = await response.json() as { models: Array<{ name: string }> };
    
    return data.models.map(m => createModel(m.name, "ollama-cloud", { 
      label: "cloud",
      isCloud: true 
    }));
  } catch {
    return [];
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `(${gb.toFixed(1)}GB)` : `(${(bytes / 1024 / 1024).toFixed(0)}MB)`;
}

// ============================================================================
// COMMANDS
// ============================================================================

async function handleStatus(ctx: any): Promise<void> {
  const isLocalRunning = await testLocalConnection();
  const hasApiKey = !!CONFIG.apiKey;
  
  const status = [
    "🦙 Ollama Status",
    "",
    `Local: ${isLocalRunning ? "✅ Connected" : "❌ Not running"} (${LOCAL_URL})`,
    `Cloud: ${hasApiKey ? "✅ API key set" : "⚠️ No API key"}`,
    "",
    "🔧 Commands:",
    "/ollama-status    - Check connection",
    "/ollama-models   - List available models",
  ];
  
  ctx.ui?.notify?.(status.join("\n"), "info");
}

async function handleModels(pi: ExtensionAPI, ctx: any): Promise<void> {
  ctx.ui?.notify?.("Fetching models...", "info");
  
  const localModels = await fetchLocalModels();
  const cloudModels = CONFIG.apiKey ? await fetchCloudModels(CONFIG.apiKey) : [];
  
  const lines = ["🦙 Available Models\n"];
  
  if (localModels.length > 0) {
    lines.push("📍 Local:");
    localModels.forEach(m => lines.push(`  ${m.name}`));
    lines.push("");
  }
  
  if (cloudModels.length > 0) {
    lines.push("☁️  Cloud:");
    cloudModels.forEach(m => lines.push(`  ${m.name}`));
  }
  
  if (localModels.length === 0 && cloudModels.length === 0) {
    lines.push("No models found. Ensure Ollama is running locally or set API key for cloud.");
  }
  
  ctx.ui?.notify?.(lines.join("\n"), "info");
  
  // Register with pi
  const allModels = [...localModels, ...cloudModels];
  if (allModels.length > 0 && (pi as any).registerProviderModels) {
    (pi as any).registerProviderModels("ollama", allModels);
  }
}

// ============================================================================
// EXTENSION EXPORT
// ============================================================================

export default function ollamaExtension(pi: ExtensionAPI) {
  loadConfig(pi);
  
  pi.registerCommand("ollama-status", {
    description: "Check Ollama connection status",
    handler: async (_args: string, ctx: any) => handleStatus(ctx),
  });
  
  pi.registerCommand("ollama-models", {
    description: "List available Ollama models",
    handler: async (_args: string, ctx: any) => handleModels(pi, ctx),
  });
  
  pi.registerCommand("ollama", {
    description: "Ollama management",
    handler: async (args: string, ctx: any) => {
      const sub = args.trim().split(/\s+/)[0];
      switch (sub) {
        case "status": return handleStatus(ctx);
        case "models": return handleModels(pi, ctx);
        default:
          ctx.ui?.notify?.([
            "🦙 Ollama Commands",
            "",
            "/ollama-status  - Check connection",
            "/ollama-models   - List models",
          ].join("\n"), "info");
      }
    },
  });
  
  // Auto-register models on startup
  fetchLocalModels().then(models => {
    if (models.length > 0 && (pi as any).registerProviderModels) {
      (pi as any).registerProviderModels("ollama", models);
    }
  });
  
  console.log("[Pi Ollama] Extension loaded");
  console.log("[Pi Ollama] Commands: /ollama [status|models]");
}

// Re-export for TypeScript
export { createModel, fetchLocalModels, fetchCloudModels };
