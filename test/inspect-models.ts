/**
 * Inspect Local Ollama Models
 * 
 * Fetches /api/show for all installed models to see their actual metadata
 */

const LOCAL_URL = "http://localhost:11434";

interface ModelInfo {
  name: string;
  model_info?: Record<string, any>;
  details?: Record<string, any>;
  capabilities?: string[];
}

async function fetchLocalModels(): Promise<string[]> {
  try {
    const response = await fetch(`${LOCAL_URL}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch {
    return [];
  }
}

async function fetchModelShow(modelName: string): Promise<ModelInfo | null> {
  try {
    const response = await fetch(`${LOCAL_URL}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function main() {
  console.log("🔍 Inspecting Local Ollama Models\n");
  
  const models = await fetchLocalModels();
  
  if (models.length === 0) {
    console.log("❌ No models found or Ollama not running");
    console.log("Make sure Ollama is started: ollama serve");
    return;
  }
  
  console.log(`Found ${models.length} model(s):\n`);
  
  for (const modelName of models) {
    console.log("=".repeat(60));
    console.log(`📦 ${modelName}`);
    console.log("=".repeat(60));
    
    const details = await fetchModelShow(modelName);
    
    if (!details) {
      console.log("  ❌ Failed to fetch details\n");
      continue;
    }
    
    // Show model_info keys
    if (details.model_info) {
      console.log("\n  📋 Model Info Keys:");
      const entries = Object.entries(details.model_info);
      
      // Find context-related keys
      const contextKeys = entries.filter(([k]) => 
        k.toLowerCase().includes('context') || 
        k.toLowerCase().includes('length')
      );
      
      if (contextKeys.length > 0) {
        console.log("  \n  🎯 Context-Length Related:");
        for (const [key, value] of contextKeys) {
          console.log(`     ${key}: ${value}`);
        }
      }
      
      // Show first 30 keys (increased from 20)
      console.log("\n  📋 First keys (up to 30):");
      let count = 0;
      for (const [key, value] of entries.slice(0, 30)) {
        const valueStr = JSON.stringify(value).slice(0, 60);
        console.log(`     ${key}: ${valueStr}${JSON.stringify(value).length > 60 ? '...' : ''}`);
        count++;
      }
      if (entries.length > 30) {
        console.log(`     ... and ${entries.length - 30} more`);
      }
      
      // Calculate context length using the actual extension function
      const { getContextLength } = await import("../src/index.ts");
      const contextLength = getContextLength(details.model_info, modelName);
      console.log(`\n  📏 Detected Context Length: ${contextLength.toLocaleString()} tokens`);
    } else {
      console.log("  ℹ️ No model_info returned (cloud model)");
      
      // Try name-based detection
      const { getContextLength } = await import("../src/index.ts");
      const contextLength = getContextLength({}, modelName);
      console.log(`\n  📏 Estimated from name: ${contextLength.toLocaleString()} tokens`);
    }
    
    // Show capabilities if present
    if (details.capabilities && details.capabilities.length > 0) {
      console.log("\n  🔧 Capabilities:");
      for (const cap of details.capabilities) {
        console.log(`     - ${cap}`);
      }
    }
    
    // Show details
    if (details.details && Object.keys(details.details).length > 0) {
      console.log("\n  📊 Details:");
      for (const [key, value] of Object.entries(details.details)) {
        if (value) console.log(`     ${key}: ${value}`);
      }
    }
    
    console.log("\n");
  }
  
  console.log("=".repeat(60));
  console.log("✅ Inspection Complete");
  console.log("=".repeat(60));
}

main();
