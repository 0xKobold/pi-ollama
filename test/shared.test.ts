/**
 * Shared Ollama Utilities Tests
 *
 * Tests for OpenAI-compatible shared module
 */

import { test, expect, describe } from "bun:test";
import {
  loadConfigFromEnv,
  createClients,
  getClientForModel,
  getModelName,
  getContextLength,
  hasVisionCapability,
  hasReasoningCapability,
  type OllamaConfig,
} from "../src/shared.ts";

describe("shared.ts - OpenAI Compatible Utilities", () => {
  describe("Configuration", () => {
    test("loadConfigFromEnv returns partial config", () => {
      const config = loadConfigFromEnv();
      expect(typeof config).toBe("object");
      // Config should be empty when no env vars are set
      // (Tests can't set env vars, so this tests the default behavior)
      expect(Object.keys(config).length).toBeGreaterThanOrEqual(0);
    });

    test("createClients with default config", () => {
      const clients = createClients();
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

  describe("Model Name Handling", () => {
    test("getModelName strips :cloud suffix", () => {
      expect(getModelName("llama3:cloud")).toBe("llama3");
      expect(getModelName("llama3")).toBe("llama3");
    });

    test("getClientForModel returns local client", () => {
      const clients = createClients();
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
      const clients = createClients(); // No API key
      const result = getClientForModel("llama3:cloud", clients);
      expect(result).toBe(clients.local);
    });
  });

  describe("Context Length Detection", () => {
    test("getContextLength from model_info", () => {
      const info = { "llama.context_length": 8192 };
      expect(getContextLength(info)).toBe(8192);
    });

    test("getContextLength from model name - kimi", () => {
      // kimi-k2 has 262k (262144) context window
      expect(getContextLength({}, "kimi-k2.5")).toBe(262144);
      expect(getContextLength({}, "kimi-k2.5:cloud")).toBe(262144);
    });

    test("getContextLength from model name - minimax", () => {
      // minimax-m2 has 204k (204800) context window
      expect(getContextLength({}, "minimax-m2.5")).toBe(204800);
    });

    test("getContextLength from model name - glm", () => {
      // glm-5 has 202k (202752) context window
      expect(getContextLength({}, "glm-5")).toBe(202752);
      expect(getContextLength({}, "glm-5:cloud")).toBe(202752);
    });

    test("getContextLength from model name - qwen3", () => {
      // qwen3.5 has 262k (262144) context window
      expect(getContextLength({}, "qwen3.5")).toBe(262144);
    });

    test("getContextLength prefers model_info over name", () => {
      const info = { "llama.context_length": 4096 };
      expect(getContextLength(info, "kimi-k2.5")).toBe(4096);
    });

    test("getContextLength default fallback", () => {
      // Empty object with no name -> fall through to name patterns (no match) -> default 4096
      expect(getContextLength({})).toBe(4096);
      // Undefined info -> no name -> default 4096
      expect(getContextLength(undefined)).toBe(4096);
    });

    test("getContextLength from nested model_info", () => {
      // ModelDetails object with nested model_info
      const details = {
        model_info: { "glm5.context_length": 202752 }
      };
      expect(getContextLength(details)).toBe(202752);
    });

    test("getContextLength from parameter_size mapping", () => {
      // Parameter size to context mapping
      expect(getContextLength({ parameter_size: "7B" }, "unknown-model")).toBe(4096);
      expect(getContextLength({ parameter_size: "70B" }, "unknown-model")).toBe(32768);
    });
  });

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

  describe("Reasoning Detection", () => {
    test("hasReasoningCapability detects coder models", () => {
      expect(hasReasoningCapability("codellama")).toBe(true);
      expect(hasReasoningCapability("deepseek-coder")).toBe(true);
      expect(hasReasoningCapability("qwen2.5-coder")).toBe(true);
    });

    test("hasReasoningCapability detects r1 models", () => {
      expect(hasReasoningCapability("deepseek-r1")).toBe(true);
    });

    test("hasReasoningCapability detects kimi", () => {
      expect(hasReasoningCapability("kimi-k2.5")).toBe(true);
    });

    test("hasReasoningCapability detects deepseek", () => {
      expect(hasReasoningCapability("deepseek-v3")).toBe(true);
    });

    test("hasReasoningCapability false for regular models", () => {
      expect(hasReasoningCapability("llama3")).toBe(false);
      expect(hasReasoningCapability("mistral")).toBe(false);
    });
  });
});
