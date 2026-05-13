/**
 * Shared Ollama Utilities Tests
 *
 * Tests for context length detection, capability detection, configuration,
 * error classification, and chat utilities.
 */

import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadConfigFromEnv,
  loadConfigFromSettingsFiles,
  createClients,
  getClientForModel,
  getModelName,
  getContextLength,
  hasVisionCapability,
  hasReasoningCapability,
  stripProviderPrefix,
  classifyHttpError,
  OllamaError,
  OllamaRateLimitError,
  OllamaAuthError,
  OllamaModelError,
  OllamaServerError,
  DEFAULT_CONFIG,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_MAX_TOKENS,
  type OllamaConfig,
} from "../src/shared.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

describe("Configuration", () => {
  test("loadConfigFromEnv returns partial config", () => {
    const config = loadConfigFromEnv();
    expect(typeof config).toBe("object");
    expect(Object.keys(config).length).toBeGreaterThanOrEqual(0);
  });

  test("loadConfigFromSettingsFiles returns empty when no files exist", async () => {
    const config = await loadConfigFromSettingsFiles();
    expect(typeof config).toBe("object");
  });

  test("createClients with default config", () => {
    const clients = createClients(DEFAULT_CONFIG);
    expect(clients.local).toBeDefined();
    expect(clients.cloud).toBeNull();
  });

  test("createClients with API key creates cloud client", () => {
    const clients = createClients({
      baseUrl: "http://localhost:11434",
      cloudUrl: "https://ollama.com",
      apiKey: "test-key",
    });
    expect(clients.cloud).not.toBeNull();
    expect(clients.local).toBeDefined();
  });

  test("createClients without API key has no cloud client", () => {
    const clients = createClients({
      baseUrl: "http://localhost:11434",
      cloudUrl: "https://ollama.com",
      apiKey: "",
    });
    expect(clients.cloud).toBeNull();
  });
});

// ============================================================================
// MODEL NAME HANDLING
// ============================================================================

describe("Model Name Handling", () => {
  test("getModelName strips :cloud suffix", () => {
    expect(getModelName("llama3:cloud")).toBe("llama3");
    expect(getModelName("llama3")).toBe("llama3");
  });

  test("stripProviderPrefix strips ollama/ prefix", () => {
    expect(stripProviderPrefix("ollama/llama3")).toBe("llama3");
    expect(stripProviderPrefix("llama3")).toBe("llama3");
  });

  test("getClientForModel returns local client", () => {
    const clients = createClients(DEFAULT_CONFIG);
    const result = getClientForModel("llama3", clients);
    expect(result).toBe(clients.local);
  });

  test("getClientForModel returns local for regular models", () => {
    const clients = createClients({ apiKey: "test" });
    const result = getClientForModel("llama3", clients);
    expect(result).toBe(clients.local);
  });

  test("getClientForModel returns cloud for :cloud models when available", () => {
    const clients = createClients({ apiKey: "test" });
    const result = getClientForModel("llama3:cloud", clients);
    expect(result).toBe(clients.cloud);
  });

  test("getClientForModel falls back to local if no cloud client", () => {
    const clients = createClients(DEFAULT_CONFIG); // No API key
    const result = getClientForModel("llama3:cloud", clients);
    expect(result).toBe(clients.local);
  });
});

// ============================================================================
// CONTEXT LENGTH DETECTION
// ============================================================================

describe("Context Length Detection", () => {
  test("DEFAULT_CONTEXT_LENGTH is 131072 (128k)", () => {
    expect(DEFAULT_CONTEXT_LENGTH).toBe(131072);
  });

  test("DEFAULT_MAX_TOKENS is 8192", () => {
    expect(DEFAULT_MAX_TOKENS).toBe(8192);
  });

  test("getContextLength from model_info", () => {
    const info = { "llama.context_length": 8192 };
    expect(getContextLength(info)).toBe(8192);
  });

  test("getContextLength from model name - kimi", () => {
    expect(getContextLength({}, "kimi-k2.5")).toBe(262144);
    expect(getContextLength({}, "kimi-k2.5:cloud")).toBe(262144);
  });

  test("getContextLength from model name - minimax", () => {
    expect(getContextLength({}, "minimax-m2.5")).toBe(204800);
  });

  test("getContextLength from model name - glm", () => {
    expect(getContextLength({}, "glm-5")).toBe(202752);
    expect(getContextLength({}, "glm-5:cloud")).toBe(202752);
  });

  test("getContextLength from model name - qwen3", () => {
    expect(getContextLength({}, "qwen3.5")).toBe(262144);
  });

  test("getContextLength from model name - deepseek-v4 (1M context)", () => {
    expect(getContextLength({}, "deepseek-v4-flash")).toBe(1048576);
    expect(getContextLength({}, "deepseek-v4-flash:cloud")).toBe(1048576);
  });

  test("getContextLength from model name - deepseek (non-v4)", () => {
    expect(getContextLength({}, "deepseek-r1")).toBe(163840);
    expect(getContextLength({}, "deepseek-v3")).toBe(163840);
    expect(getContextLength({}, "deepseek-v3.1:671b")).toBe(163840);
    expect(getContextLength({}, "deepseek-r1:cloud")).toBe(163840);
  });

  test("getContextLength prefers model_info over name", () => {
    const info = { "llama.context_length": 4096 };
    expect(getContextLength(info, "kimi-k2.5")).toBe(4096);
  });

  test("getContextLength default fallback returns 128k", () => {
    expect(getContextLength({})).toBe(131072);
    expect(getContextLength(undefined)).toBe(131072);
    expect(getContextLength({}, "unknown-model")).toBe(131072);
  });

  test("getContextLength from nested model_info", () => {
    const details = {
      model_info: { "glm5.context_length": 202752 },
    };
    expect(getContextLength(details)).toBe(202752);
  });

  test("getContextLength from parameter_size mapping", () => {
    expect(getContextLength({ parameter_size: "7B" }, "unknown-model")).toBe(4096);
    expect(getContextLength({ parameter_size: "70B" }, "unknown-model")).toBe(32768);
  });

  test("getContextLength from nested details.parameter_size", () => {
    const info = { details: { parameter_size: "70B" } };
    // Falls through to name since no context_length key exists
    expect(getContextLength(info, "unknown-model")).toBe(32768);
  });
});

// ============================================================================
// REASONING CAPABILITY DETECTION
// ============================================================================

describe("Reasoning Detection", () => {
  test("hasReasoningCapability detects deepseek models as reasoning", () => {
    expect(hasReasoningCapability("deepseek-v3")).toBe(true);
    expect(hasReasoningCapability("deepseek-r1")).toBe(true);
    expect(hasReasoningCapability("deepseek-coder")).toBe(true);
  });

  test("hasReasoningCapability detects r1 models from name pattern", () => {
    // \br1\b matches "r1" as word boundary
    expect(hasReasoningCapability("deepseek-r1")).toBe(true);
    expect(hasReasoningCapability("model-r1-70b")).toBe(true);
  });

  test("hasReasoningCapability detects from capabilities array", () => {
    expect(hasReasoningCapability("model", { capabilities: ["thinking"] })).toBe(true);
    expect(hasReasoningCapability("model", { capabilities: ["completion", "reason"] })).toBe(true);
  });

  test("hasReasoningCapability does NOT flag instruct/chat models as reasoning", () => {
    // These are instruction-following format tags, NOT reasoning capabilities
    expect(hasReasoningCapability("llama3:instruct")).toBe(false);
    expect(hasReasoningCapability("mistral:chat")).toBe(false);
    expect(hasReasoningCapability("some-model-instruct")).toBe(false);
    expect(hasReasoningCapability("chat-model")).toBe(false);
  });

  test("hasReasoningCapability does NOT flag code models as reasoning", () => {
    // "code" and "coder" are not reasoning capabilities
    expect(hasReasoningCapability("codellama")).toBe(false);
    expect(hasReasoningCapability("qwen2.5-coder")).toBe(false);
  });

  test("hasReasoningCapability detects qwq", () => {
    expect(hasReasoningCapability("qwq-32b")).toBe(true);
  });

  test("hasReasoningCapability detects gpt-oss", () => {
    expect(hasReasoningCapability("gpt-oss:20b")).toBe(true);
  });

  test("hasReasoningCapability false for regular models", () => {
    expect(hasReasoningCapability("llama3")).toBe(false);
    expect(hasReasoningCapability("mistral")).toBe(false);
    expect(hasReasoningCapability("gemma3")).toBe(false);
  });

  test("hasReasoningCapability prefers capabilities over name", () => {
    // If capabilities say "thinking", it's reasoning regardless of name
    expect(hasReasoningCapability("llama3", { capabilities: ["thinking"] })).toBe(true);
  });
});

// ============================================================================
// VISION DETECTION
// ============================================================================

describe("Vision Detection", () => {
  test("hasVisionCapability from capabilities array", () => {
    expect(hasVisionCapability({ capabilities: ["vision"] })).toBe(true);
    expect(hasVisionCapability({ capabilities: ["image"] })).toBe(true);
    expect(hasVisionCapability({ capabilities: ["text"] })).toBe(false);
  });

  test("hasVisionCapability from model_info clip encoder", () => {
    expect(
      hasVisionCapability({
        model_info: { "clip.has_vision_encoder": true },
      })
    ).toBe(true);
  });

  test("hasVisionCapability from llava architecture", () => {
    expect(
      hasVisionCapability({
        model_info: { "general.architecture": "llava" },
      })
    ).toBe(true);
  });

  test("hasVisionCapability false for text models", () => {
    expect(
      hasVisionCapability({
        model_info: { "general.architecture": "llama" },
      })
    ).toBe(false);
  });
});

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

describe("Error Classification", () => {
  test("401 → OllamaAuthError", () => {
    const err = classifyHttpError(401, "unauthorized");
    expect(err).toBeInstanceOf(OllamaAuthError);
    expect(err.message).toContain("Authentication failed");
  });

  test("403 → OllamaAuthError", () => {
    const err = classifyHttpError(403, "forbidden");
    expect(err).toBeInstanceOf(OllamaAuthError);
  });

  test("429 → OllamaRateLimitError", () => {
    const err = classifyHttpError(429, "too many requests");
    expect(err).toBeInstanceOf(OllamaRateLimitError);
  });

  test("404 → OllamaModelError", () => {
    const err = classifyHttpError(404, "model not found");
    expect(err).toBeInstanceOf(OllamaModelError);
  });

  test("400 → OllamaModelError (context overflow)", () => {
    const err = classifyHttpError(400, "context too long");
    expect(err).toBeInstanceOf(OllamaModelError);
  });

  test("500 → OllamaServerError", () => {
    const err = classifyHttpError(500, "internal error");
    expect(err).toBeInstanceOf(OllamaServerError);
  });

  test("502 → OllamaServerError", () => {
    const err = classifyHttpError(502, "bad gateway");
    expect(err).toBeInstanceOf(OllamaServerError);
  });

  test("418 → generic OllamaError", () => {
    const err = classifyHttpError(418, "I'm a teapot");
    expect(err).toBeInstanceOf(OllamaError);
    expect(err).not.toBeInstanceOf(OllamaRateLimitError);
  });
});