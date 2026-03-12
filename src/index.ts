/**
 * Pi Ollama Extension
 * 
 * Unified local + cloud Ollama support for pi-coding-agent
 * Uses /api/show for accurate model details (context length, capabilities)
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
 * - Accurate context length from /api/show
 * - Vision capability detection from model metadata
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

interface ModelDetails {
  name: string;
  capabilities?: string[];
  model_info?: {
    "gemma3.context_length"?: number;
    "llama.context_length"?: number;
    "general.context_length"?: number;
    [key: string]: any;
  };
  details?: {
    parameter_size?: string;
    family?: string;
    quantization_level?: string;
  };
  modified_at?: string;
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

async function fetchModelDetails(modelName: string, baseUrl: string = LOCAL_URL): Promise<ModelDetails | null> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/show`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName, verbose: true }),
      },
      5000
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      name: modelName,
      capabilities: data.capabilities || [],
      model_info: data.model_info || {},
      details: data.details || {},
      modified_at: data.modified_at,
    };
  } catch (e) {
    console.error(`[pi-ollama] Failed to fetch details for ${modelName}:`, e);
    return null;
  }
}

function getContextLength(modelInfo: ModelDetails["model_info"]): number {
  if (!modelInfo) return 128000;
  
  // Try common context length keys
  const contextKeys = [
    "general.context_length",
    "gemma3.context_length", 
    "llama.context_length",
    "mistral.context_length",
    "qwen2.context_length",
    "phi3.context_length",
  ];
  
  for (const key of contextKeys) {
    if (modelInfo[key]) {
      return modelInfo[key];
    }
  }
  
  return 128000; // Default fallback
}

function hasVisionCapability(details: ModelDetails): boolean {
  // Check capabilities array from /api/show
  if (details.capabilities?.includes("vision")) return true;
  
  // Check model_info for vision-related keys
  const modelInfo = details.model_info || {};
  const visionKeys = Object.keys(modelInfo).some(key => 
    key.includes("vision") || key.includes("mm.")
  );
  
  return visionKeys;
}

function hasReasoningCapability(name: string): boolean {
  const lowerName = name.toLowerCase();
  return ["coder", "r1", "deepseek", "kimi", "think", "reason"].some(kw => 
    lowerName.includes(kw)
  );
}

// ============================================================================
// MODEL FACTORY (with /api/show data)
// ============================================================================

function createModel(
  name: string, 
  prefix: string, 
  options: { 
    label?: string; 
    isCloud?: boolean;
    details?: ModelDetails | null;
    size?: number;
  } = {}
): ProviderModelConfig {
  const { label = "", isCloud = false, details } = options;
  
  // Get accurate data from /api/show
  const contextWindow = details ? getContextLength(details.model_info) : 128000;
  const isVision = details ? hasVisionCapability(details) : false;
  const isReasoning = hasReasoningCapability(name);
  
  // Build display name
  const parts: string[] = [];
  if (isCloud) parts.push("☁️");
  if (isVision) parts.push("👁️");
  
  // Add parameter size from details
  const paramSize = details?.details?.parameter_size;
  const sizeLabel = paramSize ? `${paramSize}` : label;
  if (sizeLabel) parts.push(sizeLabel);
  
  const displayName = parts.length > 0 
    ? `${name} (${parts.join(" ")})`
    : name;

  const modelId = isCloud ? `${name}:cloud` : name;
  const inputTypes: ("text" | "image")[] = isVision ? ["text", "image"] : ["text"];

  return {
    id: modelId,
    name: displayName,
    api: "openai-completions",
    reasoning: isReasoning,
    input: inputTypes,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens: Math.min(8192, Math.floor(contextWindow / 16)), // Reasonable default
  };
}

// ============================================================================
// MODEL FETCHING (with accurate details)
// ============================================================================

async function fetchLocalModels(): Promise<ProviderModelConfig[]> {
  try {
    const response = await fetchWithTimeout(`${LOCAL_URL}/api/tags`, {}, 5000);
    const data = await response.json() as { models: Array<{ name: string; size?: number }> };
    
    // Fetch details for each model (in parallel)
    const modelsWithDetails = await Promise.all(
      data.models.map(async (m) => {
        const details = await fetchModelDetails(m.name, LOCAL_URL);
        return createModel(m.name, "ollama", { 
          details,
          size: m.size,
          label: formatSize(m.size || 0)
        });
      })
    );
    
    return modelsWithDetails;
  } catch (e) {
    console.error("[pi-ollama] Failed to fetch local models:", e);
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
    
    // Fetch details for cloud models (may not be available, but try)
    const modelsWithDetails = await Promise.all(
      data.models.map(async (m) => {
        const details = await fetchModelDetails(m.name, CLOUD_URL);
        return createModel(m.name, "ollama-cloud", { 
          label: "cloud",
          isCloud: true,
          details
        });
      })
    );
    
    return modelsWithDetails.filter(m => m.id); // Filter out failures
  } catch (e) {
    console.error("[pi-ollama] Failed to fetch cloud models:", e);
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
    "/ollama-status         - Check connection",
    "/ollama-models        - List available models",
    "/ollama-info MODEL    - Show model details",
    "",
    "Features:",
    "  • Accurate context length from /api/show",
    "  • Vision detection from capabilities",
    "  • Parameter size in model names",
  ];
  
  ctx.ui?.notify?.(status.join("\n"), "info");
}

async function handleModelInfo(args: string, ctx: any): Promise<void> {
  const modelName = args.trim();
  if (!modelName) {
    ctx.ui?.notify?.("Usage: /ollama-info MODEL_NAME", "warning");
    return;
  }
  
  ctx.ui?.notify?.(`Fetching details for ${modelName}...`, "info");
  
  const details = await fetchModelDetails(modelName, LOCAL_URL);
  
  if (!details) {
    ctx.ui?.notify?.(`Could not fetch details for ${modelName}. Is the model pulled?`, "error");
    return;
  }
  
  const contextLength = getContextLength(details.model_info);
  const isVision = hasVisionCapability(details);
  const paramSize = details.details?.parameter_size || "Unknown";
  const family = details.details?.family || "Unknown";
  
  const lines = [
    `🦙 Model: ${modelName}`,
    "",
    `📊 Parameters: ${paramSize}`,
    `🏷️  Family: ${family}`,
    `📏 Context Length: ${contextLength.toLocaleString()} tokens`,
    `👁️  Vision: ${isVision ? "✅ Yes" : "❌ No"}`,
    "",
    "Capabilities:",
    ...(details.capabilities?.map(c => `  • ${c}`) || ["  • Unknown"]),
  ];
  
  ctx.ui?.notify?.(lines.join("\n"), "info");
}

async function handleModels(pi: ExtensionAPI, ctx: any): Promise<void> {
  ctx.ui?.notify?.("Fetching models with accurate details...", "info");
  
  const localModels = await fetchLocalModels();
  const cloudModels = CONFIG.apiKey ? await fetchCloudModels(CONFIG.apiKey) : [];
  
  const lines = ["🦙 Available Models\n"];
  
  if (localModels.length > 0) {
    lines.push("📍 Local:");
    localModels.forEach(m => {
      const vision = m.input?.includes("image") ? "👁️" : "";
      const reasoning = m.reasoning ? "🧠" : "";
      lines.push(`  ${vision}${reasoning} ${m.name} (${m.contextWindow.toLocaleString()} ctx)`);
    });
    lines.push("");
  }
  
  if (cloudModels.length > 0) {
    lines.push("☁️  Cloud:");
    cloudModels.forEach(m => {
      const vision = m.input?.includes("image") ? "👁️" : "";
      lines.push(`  ${vision} ${m.name} (${m.contextWindow.toLocaleString()} ctx)`);
    });
  }
  
  if (localModels.length === 0 && cloudModels.length === 0) {
    lines.push("No models found. Ensure Ollama is running locally or set API key for cloud.");
  }
  
  lines.push("");
  lines.push("💡 Get model details: /ollama-info gemma3");
  
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
  
  pi.registerCommand("ollama-info", {
    description: "Show model details from /api/show",
    handler: async (args: string, ctx: any) => handleModelInfo(args, ctx),
  });
  
  pi.registerCommand("ollama-models", {
    description: "List available Ollama models",
    handler: async (_args: string, ctx: any) => handleModels(pi, ctx),
  });
  
  pi.registerCommand("ollama", {
    description: "Ollama management",
    handler: async (args: string, ctx: any) => {
      const [sub, ...rest] = args.trim().split(/\s+/);
      const restArgs = rest.join(" ");
      switch (sub) {
        case "status": return handleStatus(ctx);
        case "info": return handleModelInfo(restArgs, ctx);
        case "models": return handleModels(pi, ctx);
        default:
          ctx.ui?.notify?.([
            "🦙 Ollama Commands",
            "",
            "/ollama-status         - Check connection",
            "/ollama-info MODEL    - Show model details",
            "/ollama-models        - List models",
            "",
            "Uses /api/show for accurate:",
            "  • Context length",
            "  • Vision capabilities", 
            "  • Model family",
          ].join("\n"), "info");
      }
    },
  });
  
  // Auto-register models on startup
  fetchLocalModels().then(models => {
    if (models.length > 0 && (pi as any).registerProviderModels) {
      (pi as any).registerProviderModels("ollama", models);
      console.log(`[pi-ollama] Registered ${models.length} models with accurate details`);
    }
  });
  
  console.log("[pi-ollama] Extension loaded");
  console.log("[pi-ollama] Uses /api/show for accurate context length & capabilities");
}

// Re-export for TypeScript
export { 
  createModel, 
  fetchLocalModels, 
  fetchCloudModels, 
  fetchModelDetails,
  getContextLength,
  hasVisionCapability,
  hasReasoningCapability,
};
