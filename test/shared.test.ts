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
      // Should have keys even if undefined
      expect("baseUrl" in config).toBe(true);
      expect("cloudUrl" in config).toBe(true);
      expect("apiKey" in config).toBe(true);
    });

    test("createClients with default config", () => {
      const clients = createClients();
      expect(clients.local.baseUrl).toBe("http://localhost:11434");
      expect(clients.cloud).toBeNull();
      expect(clients.hasApiKey).toBe(false);
    });

    test("createClients with API key creates cloud client", () => {
      const clients = createClients({
        baseUrl: "http://localhost:11434",
        cloudUrl: "https://ollama.com",
        apiKey: "test-key",
      });
      expect(clients.cloud).not.toBeNull();
      expect(clients.cloud?.apiKey).toBe("test-key");
      expect(clients.hasApiKey).toBe(true);
    });

    test("createClients strips trailing slashes", () => {
      const clients = createClients({
        baseUrl: "http://localhost:11434/",
        cloudUrl: "https://ollama.com/",
        apiKey: "test", // Need API key to create cloud client
      });
      expect(clients.local.baseUrl).toBe("http://localhost:11434");
      expect(clients.cloud?.baseUrl).toBe("https://ollama.com");
    });
  });

  describe("Model Name Handling", () => {
    test("getModelName strips :cloud suffix", () => {
      expect(getModelName("llama3:cloud")).toBe("llama3");
      expect(getModelName("llama3")).toBe("llama3");
    });

    test("getClientForModel returns local for regular models", () => {
      const clients = createClients({ apiKey: "test" });
      const result = getClientForModel("llama3", clients, false);
      expect(result.isCloud).toBe(false);
      expect(result.client).toBe(clients.local);
    });

    test("getClientForModel returns cloud for :cloud models", () => {
      const clients = createClients({ apiKey: "test" });
      const result = getClientForModel("llama3:cloud", clients, false);
      expect(result.isCloud).toBe(true);
      expect(result.client).toBe(clients.cloud);
    });

    test("getClientForModel falls back to local if no cloud client", () => {
      const clients = createClients(); // No API key
      const result = getClientForModel("llama3:cloud", clients, false);
      expect(result.isCloud).toBe(false); // Falls back to local
      expect(result.client).toBe(clients.local);
    });
  });

  describe("Context Length Detection", () => {
    test("getContextLength from model_info", () => {
      const info = { "llama.context_length": 8192 };
      expect(getContextLength(info)).toBe(8192);
    });

    test("getContextLength from model name - kimi", () => {
      expect(getContextLength({}, "kimi-k2.5")).toBe(256000);
      expect(getContextLength({}, "kimi-k2.5:cloud")).toBe(256000);
    });

    test("getContextLength from model name - minimax", () => {
      expect(getContextLength({}, "minimax-m2.5")).toBe(256000);
    });

    test("getContextLength prefers model_info over name", () => {
      const info = { "llama.context_length": 4096 };
      expect(getContextLength(info, "kimi-k2.5")).toBe(4096);
    });

    test("getContextLength default fallback", () => {
      expect(getContextLength({})).toBe(128000);
      expect(getContextLength(undefined)).toBe(128000);
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

    test("hasReasoningCapability false for regular models", () => {
      expect(hasReasoningCapability("llama3")).toBe(false);
      expect(hasReasoningCapability("mistral")).toBe(false);
    });
  });
});
