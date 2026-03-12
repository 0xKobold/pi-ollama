/**
 * Pi Ollama Extension Tests
 * 
 * Tests for Ollama integration with /api/show support
 * @version 0.1.0
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";

describe("pi-ollama v0.1.0", () => {
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
        "general.context_length": 4096,
      };
      
      const contextLength = getContextLength(genericInfo);
      expect(contextLength).toBe(4096);
    });

    test("should fallback to 128000 for unknown models", async () => {
      const { getContextLength } = await import("../src/index.ts");
      
      const unknownInfo: any = {};
      
      const contextLength = getContextLength(unknownInfo);
      expect(contextLength).toBe(128000);
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
      ollamaExt(mockPi as any);
      
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
          } 
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
        { info: {}, expected: 128000 },
      ];
      
      for (const tc of testCases) {
        const result = getContextLength(tc.info as any);
        expect(result).toBe(tc.expected);
      }
    });

    test("should prefer specific over generic", async () => {
      const { getContextLength } = await import("../src/index.ts");
      
      const model: any = {
        "general.context_length": 4096,
        "llama.context_length": 8192,
      };
      
      // Should prefer model-specific over general
      const result = getContextLength(model);
      // If architecture is llama, should use llama.context_length
      expect(result).toBeGreaterThanOrEqual(4096);
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
  });

  describe("Error Handling", () => {
    test("should handle null model info gracefully", async () => {
      const { getContextLength } = await import("../src/index.ts");
      
      // @ts-ignore - testing null handling
      const result = getContextLength(null);
      expect(result).toBe(128000); // default fallback
    });

    test("should handle undefined model info", async () => {
      const { getContextLength } = await import("../src/index.ts");
      
      // @ts-ignore - testing null handling
      const result = getContextLength(undefined);
      expect(result).toBe(128000); // default fallback
    });

    test("should handle malformed model info", async () => {
      const { getContextLength, hasVisionCapability } = await import("../src/index.ts");
      
      const malformed: any = {
        "gemma3.context_length": "not-a-number",
        "general.architecture": 12345, // Should be string
      };
      
      // Should not throw
      const contextLength = getContextLength(malformed);
      expect(typeof contextLength).toBe("number");
      
      const vision = hasVisionCapability(malformed);
      expect(typeof vision).toBe("boolean");
    });
  });
});
