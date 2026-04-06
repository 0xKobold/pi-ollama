---
name: create-pi-package
description: Use when asked to create a new pi package. Scaffolds extensions, skills, prompts, and themes following pi-coding-agent conventions. Also use when creating 0xKobold packages for the packages/ directory.
---

# Create Pi Package

> Skill for scaffolding pi packages following official conventions.

## When to Use

- User asks to create a new pi package
- User asks to "package" an extension for sharing
- User wants to publish an extension to npm
- Creating 0xKobold packages in `packages/` directory

## Package Structure

Pi packages follow a simple structure:

```
my-package/
├── package.json      # Required with "pi" manifest
├── src/
│   └── index.ts      # Extension entry point
├── skills/           # Optional
│   └── my-skill/
│       └── SKILL.md
├── prompts/          # Optional
│   └── my-prompt.md
└── themes/           # Optional
    └── my-theme.json
```

## Package.json Requirements

```json
{
  "name": "@scope/pi-myextension",
  "version": "0.1.0",
  "keywords": ["pi-package"],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist/", "src/", "skills/"],
  "pi": {
    "extensions": ["./src/index.ts"],
    "skills": ["./skills/my-skill/SKILL.md"]
  },
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": ">=0.62.0",
    "@sinclair/typebox": ">=0.32.0"
  },
  "scripts": {
    "prepublishOnly": "rm -rf dist && tsc",
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest"
  }
}
```

## Extension Template

```typescript
// src/index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default async (pi: ExtensionAPI): Promise<void> => {
  console.log("[my-extension] Extension loaded");
  
  // Register tools
  pi.registerTool({
    name: "my_tool",
    label: "My Tool",
    description: "Description for the LLM",
    parameters: Type.Object({
      input: Type.String({ description: "Input description" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Tool implementation
      return {
        content: [{ type: "text", text: "result" }],
        details: {},
      };
    },
  });
  
  // Register commands
  pi.registerCommand("mycommand", {
    description: "My command description",
    handler: async (args: string, ctx) => {
      ctx.ui.notify("Command executed", "info");
    },
  });
  
  // Subscribe to events
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Session started", "info");
  });
};

// Type import for TypeBox
import { Type } from "@sinclair/typebox";
```

## For 0xKobold Packages

When creating packages in `packages/` directory:

1. **Create package directory**
2. **Initialize package.json** with proper `pi` manifest
3. **Use `./src/index.ts`** (pi bundles TypeScript directly)
4. **Add `prepublishOnly`** script to clean build

## Skill Template

```markdown
---
name: my-skill
description: When user mentions X, use this skill. Covers A, B, and C.
---

# My Skill

## Overview
Brief description...

## When to Use
- Trigger phrases

## Tool Reference
| Tool | Description |
|------|-------------|
| `tool_name` | What it does |

## Examples
```
User: "do X"
Tool: tool_name({...})
```
```

## Publishing Steps

1. **Local testing**
   ```bash
   pi install ./my-package
   # or
   pi -e ./my-package/src/index.ts
   ```

2. **Test build**
   ```bash
   npm run prepublishOnly
   # Should produce clean dist/
   ```

3. **Publish to npm**
   ```bash
   npm publish --access public
   ```

4. **Install via pi**
   ```bash
   pi install npm:@scope/pi-myextension
   ```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing `keywords: ["pi-package"]` | Add to package.json |
| Wrong extension path | Use `./src/index.ts` or `./dist/index.js` |
| dist/ has ghost files | Use `prepublishOnly: "rm -rf dist && tsc"` |
| Missing peerDependencies | Add `@mariozechner/pi-coding-agent` |

## Pi-Bridge Integration

0xKobold uses pi-bridge to auto-link packages. When creating a new package:

1. Add package to `packages/` directory
2. Update `pi-config.ts` to include it OR
3. Let pi-bridge auto-discover via symlink

## Checklist

- [ ] package.json has `"keywords": ["pi-package"]`
- [ ] package.json has valid `pi` manifest
- [ ] Extension exports `default` async function
- [ ] Extension receives `ExtensionAPI` parameter
- [ ] `prepublishOnly` script cleans dist/
- [ ] PeerDependencies are correct
- [ ] Skills have SKILL.md with name/description
