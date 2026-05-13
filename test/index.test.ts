/**
 * Pi Ollama Extension Tests
 *
 * Tests for Ollama integration with /api/show support
 * @version 0.5.0
 */

import { test, expect, describe } from "bun:test";

describe("pi-ollama v0.5.0", () => {
  describe("Model Info Extraction", () => {
    test("should extract context length from gemma3", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const gemma3Info: any = {
        "gemma3.context_length": 131072,
        "general.architecture": "gemma3",
      };

      const contextLength = getContextLength(gemma3Info);
      expect(contextLength).toBe(131072);
    });

    test("should extract context length from llama", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const llamaInfo: any = {
        "llama.context_length": 8192,
        "general.architecture": "llama",
      };

      const contextLength = getContextLength(llamaInfo);
      expect(contextLength).toBe(8192);
    });

    test("should fallback to general context_length", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const genericInfo: any = {
        "context_length": 4096,
      };

      const contextLength = getContextLength(genericInfo);
      expect(contextLength).toBe(4096);
    });

    test("should fallback to 128k for unknown models", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const unknownInfo: any = {};

      const contextLength = getContextLength(unknownInfo);
      expect(contextLength).toBe(131072); // 128k default
    });

    test("should detect vision capability", async () => {
      const { hasVisionCapability } = await import("../src/index.ts");

      const visionModel = {
        model_info: {
          "general.architecture": "llava",
          "clip.has_vision_encoder": true,
        },
      };

      expect(hasVisionCapability(visionModel as any)).toBe(true);
    });

    test("should detect no vision for text-only models", async () => {
      const { hasVisionCapability } = await import("../src/index.ts");

      const textModel = {
        model_info: {
          "general.architecture": "llama",
        },
      };

      expect(hasVisionCapability(textModel as any)).toBe(false);
    });
  });

  describe("Extension Registration", () => {
    test("should load without errors", async () => {
      const { default: ollamaExt } = await import("../src/index.ts");
      const mockPi = {
        registerCommand: () => { /* mock */ },
        registerTool: () => { /* mock */ },
        registerProvider: () => { /* mock */ },
        on: () => { /* mock */ },
        settings: { get: () => undefined },
      };

      ollamaExt(mockPi as any);
      expect(true).toBe(true);
    });

    test("should register commands", async () => {
      const commands: string[] = [];
      const mockPi = {
        registerCommand: (name: string) => commands.push(name),
        registerTool: () => { /* mock */ },
        registerProvider: () => { /* mock */ },
        on: () => { /* mock */ },
        settings: { get: () => undefined },
      };

      const { default: ollamaExt } = await import("../src/index.ts");
      await ollamaExt(mockPi as any);

      expect(commands.length).toBeGreaterThan(1);
    });
  });

  describe("Configuration", () => {
    test("should have default localhost URL", async () => {
      const { default: ollamaExt } = await import("../src/index.ts");
      const mockPi = {
        registerCommand: () => { /* mock */ },
        registerTool: () => { /* mock */ },
        registerProvider: () => { /* mock */ },
        on: () => { /* mock */ },
        settings: {
          get: (key: string) => {
            if (key === "ollama.baseUrl") return "http://localhost:11434";
            return undefined;
          },
        },
      };

      ollamaExt(mockPi as any);

      // Extension should load with default config
      expect(true).toBe(true);
    });

    test("should handle missing settings gracefully", async () => {
      const { default: ollamaExt } = await import("../src/index.ts");
      const mockPi = {
        registerCommand: () => { /* mock */ },
        registerTool: () => { /* mock */ },
        registerProvider: () => { /* mock */ },
        on: () => { /* mock */ },
        settings: { get: () => undefined },
      };

      // Should not throw with no settings
      ollamaExt(mockPi as any);
      expect(true).toBe(true);
    });
  });

  describe("Model Parsing", () => {
    test("should handle various model architectures", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const testCases = [
        { info: { "gemma3.context_length": 32000 }, expected: 32000 },
        { info: { "llama.context_length": 128000 }, expected: 128000 },
        { info: { "mistral.context_length": 32768 }, expected: 32768 },
        { info: { "qwen2.context_length": 16384 }, expected: 16384 },
        { info: { "phi3.context_length": 12000 }, expected: 12000 },
        { info: { "kimi.context_length": 262144 }, expected: 262144 },
        { info: { "kimi2_5.context_length": 262144 }, expected: 262144 },
        { info: { "deepseek.context_length": 128000 }, expected: 128000 },
        { info: { "claude.context_length": 200000 }, expected: 200000 },
        { info: { "mixtral.context_length": 32768 }, expected: 32768 },
        { info: {}, name: "kimi-k2.5", expected: 262144 }, // fallback to name
        { info: {}, name: "unknown-model", expected: 131072 }, // 128k default
      ];

      for (const tc of testCases) {
        const result = getContextLength(tc.info as any, tc.name);
        expect(result).toBe(tc.expected);
      }
    });

    test("should fallback to name detection for kimi models", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const result = getContextLength({}, "kimi-k2.5:cloud");
      expect(result).toBe(262144);
    });

    test("should detect context_length in unknown keys", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const customModel = {
        "custom_model.context_length": 64000,
      };

      const result = getContextLength(customModel as any);
      expect(result).toBe(64000);
    });

    test("should prefer specific over generic", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const model: any = {
        "context_length": 4096,
        "llama.context_length": 8192,
      };

      const result = getContextLength(model);
      expect(result).toBe(8192);
    });
  });

  describe("Export Validation", () => {
    test("should export fetchModelDetails", async () => {
      const { fetchModelDetails } = await import("../src/index.ts");
      expect(typeof fetchModelDetails).toBe("function");
    });

    test("should export getContextLength", async () => {
      const { getContextLength } = await import("../src/index.ts");
      expect(typeof getContextLength).toBe("function");
    });

    test("should export hasVisionCapability", async () => {
      const { hasVisionCapability } = await import("../src/index.ts");
      expect(typeof hasVisionCapability).toBe("function");
    });

    test("should export hasReasoningCapability", async () => {
      const { hasReasoningCapability } = await import("../src/index.ts");
      expect(typeof hasReasoningCapability).toBe("function");
    });

    test("should export error types", async () => {
      const { OllamaError, OllamaAuthError, OllamaRateLimitError, OllamaModelError, OllamaServerError } = await import("../src/index.ts");
      expect(typeof OllamaError).toBe("function");
      expect(typeof OllamaAuthError).toBe("function");
      expect(typeof OllamaRateLimitError).toBe("function");
      expect(typeof OllamaModelError).toBe("function");
      expect(typeof OllamaServerError).toBe("function");
    });

    test("should export constants", async () => {
      const { DEFAULT_CONTEXT_LENGTH, DEFAULT_MAX_TOKENS } = await import("../src/index.ts");
      expect(DEFAULT_CONTEXT_LENGTH).toBe(131072);
      expect(DEFAULT_MAX_TOKENS).toBe(8192);
    });
  });

  describe("Error Handling", () => {
    test("should handle null model info gracefully with name fallback", async () => {
      const { getContextLength } = await import("../src/index.ts");

      // @ts-ignore - testing null handling
      const result = getContextLength(null, "kimi-k2.5:cloud");
      expect(result).toBe(262144);
    });

    test("should detect kimi from name when model_info empty", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const emptyInfo = {};
      const result = getContextLength(emptyInfo, "kimi-k2.5:cloud");
      expect(result).toBe(262144);
    });

    test("should detect minimax from name", async () => {
      const { getContextLength } = await import("../src/index.ts");

      const emptyInfo = {};
      const result = getContextLength(emptyInfo, "minimax-m2.5:cloud");
      expect(result).toBe(204800);
    });

    test("should handle undefined model info", async () => {
      const { getContextLength } = await import("../src/index.ts");

      // @ts-ignore - testing null handling
      const result = getContextLength(undefined);
      expect(result).toBe(131072); // 128k default fallback
    });

    test("should handle malformed model info", async () => {
      const { getContextLength, hasVisionCapability } = await import("../src/index.ts");

      const malformed: any = {
        "gemma3.context_length": "not-a-number",
        "general.architecture": 12345,
      };

      const contextLength = getContextLength(malformed);
      expect(typeof contextLength).toBe("number");

      const vision = hasVisionCapability(malformed);
      expect(typeof vision).toBe("boolean");
    });
  });

  describe("Reasoning Capability (v0.5.0)", () => {
    test("should NOT flag instruct models as reasoning", async () => {
      const { hasReasoningCapability } = await import("../src/index.ts");
      expect(hasReasoningCapability("llama3:instruct")).toBe(false);
    });

    test("should NOT flag chat models as reasoning", async () => {
      const { hasReasoningCapability } = await import("../src/index.ts");
      expect(hasReasoningCapability("mistral:chat")).toBe(false);
    });

    test("should NOT flag code models as reasoning", async () => {
      const { hasReasoningCapability } = await import("../src/index.ts");
      expect(hasReasoningCapability("codellama")).toBe(false);
      expect(hasReasoningCapability("qwen2.5-coder")).toBe(false);
    });

    test("should detect deepseek as reasoning", async () => {
      const { hasReasoningCapability } = await import("../src/index.ts");
      expect(hasReasoningCapability("deepseek-v3")).toBe(true);
      expect(hasReasoningCapability("deepseek-r1")).toBe(true);
    });

    test("should detect r1 from capabilities", async () => {
      const { hasReasoningCapability } = await import("../src/index.ts");
      expect(hasReasoningCapability("model", { capabilities: ["thinking"] } as any)).toBe(true);
      expect(hasReasoningCapability("model", { capabilities: ["reason"] } as any)).toBe(true);
    });

    test("should detect qwq as reasoning", async () => {
      const { hasReasoningCapability } = await import("../src/index.ts");
      expect(hasReasoningCapability("qwq-32b")).toBe(true);
    });

    test("should NOT flag regular models as reasoning", async () => {
      const { hasReasoningCapability } = await import("../src/index.ts");
      expect(hasReasoningCapability("llama3")).toBe(false);
      expect(hasReasoningCapability("mistral")).toBe(false);
      expect(hasReasoningCapability("gemma3")).toBe(false);
    });
  });
});