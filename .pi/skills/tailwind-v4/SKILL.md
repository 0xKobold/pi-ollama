---
name: tailwind-v4
description: "Tailwind CSS v4 best practices. CSS-first configuration with @theme, new utilities, migration from v3, and modern patterns."
risk: safe
source: research
date_added: "2026-03-16"
---

# Tailwind CSS v4 Best Practices

> A completely rewritten Tailwind with CSS-first configuration, 5x faster builds, and modern CSS features.

---

## 1. Installation & Setup

### Vite (Recommended)

```bash
npm install tailwindcss @tailwindcss/vite
```

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

### PostCSS

```bash
npm install tailwindcss @tailwindcss/postcss
```

```javascript
// postcss.config.js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

### CSS Entry Point

```css
/* styles.css - That's it! */
@import "tailwindcss";
```

**No more:**
- `tailwind.config.js` (optional now)
- `postcss-import` plugin
- `autoprefixer` plugin
- `@tailwind base/components/utilities` directives

---

## 2. CSS-First Configuration

### The @theme Directive

Define design tokens directly in CSS:

```css
@import "tailwindcss";

@theme {
  /* Colors */
  --color-brand-50: oklch(0.98 0.01 250);
  --color-brand-100: oklch(0.95 0.03 250);
  --color-brand-500: oklch(0.65 0.15 250);
  --color-brand-900: oklch(0.30 0.08 250);
  
  /* Typography */
  --font-display: "Cal Sans", sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  
  /* Spacing (derived from single --spacing value) */
  --spacing: 0.25rem; /* px-4 = 1rem */
  
  /* Breakpoints */
  --breakpoint-xs: 375px;
  --breakpoint-3xl: 1920px;
  
  /* Animations */
  --animate-fade-in: fade-in 0.5s ease-out;
  --animate-slide-up: slide-up 0.3s ease-out;
  
  /* Shadows */
  --shadow-glow: 0 0 20px var(--color-brand-500);
}
```

### Why @theme over :root?

| @theme | :root |
|--------|-------|
| Generates utility classes | Just CSS variables |
| Tailwind-specific | Generic CSS |
| Required for utilities | For custom properties only |
| Must be top-level | Can be nested |

Use `@theme` for design tokens that should have utility classes.
Use `:root` for CSS-only variables.

---

## 3. Namespace Reference

All theme variables follow namespace conventions:

| Namespace | Creates |
|-----------|---------|
| `--color-*` | `bg-*`, `text-*`, `border-*`, etc. |
| `--font-*` | `font-*` utilities |
| `--text-*` | `text-*` size utilities |
| `--font-weight-*` | `font-*` weight utilities |
| `--breakpoint-*` | responsive `*:` variants |
| `--container-*` | `@*` container variants |
| `--spacing-*` | `p-*`, `m-*`, `w-*`, `h-*`, `gap-*` |
| `--radius-*` | `rounded-*` utilities |
| `--shadow-*` | `shadow-*` utilities |
| `--animate-*` | `animate-*` utilities |
| `--ease-*` | `ease-*` timing functions |

---

## 4. New Features in v4

### Dynamic Utility Values

No more arbitrary value syntax for simple values:

```html
<!-- v3: Required arbitrary values -->
<div class="grid-cols-[15]">
<div class="w-[137px]">

<!-- v4: Just use the number -->
<div class="grid-cols-15">
<div class="w-[137px]">  <!-- Still works for complex values -->
```

### Container Queries (Built-in)

No plugin needed:

```html
<div class="@container">
  <div class="@sm:grid-cols-2 @lg:grid-cols-4 @max-md:flex-col">
    ...
  </div>
</div>
```

### 3D Transform Utilities

```html
<div class="perspective-distant">
  <div class="rotate-x-45 rotate-y-12 transform-3d">
    3D content
  </div>
</div>
```

### Expanded Gradient API

```html
<!-- Angles -->
<div class="bg-linear-45 from-blue-500 to-purple-600">

<!-- Interpolation modes -->
<div class="bg-linear-to-r/oklch from-blue-500 to-green-500">
<div class="bg-linear-to-r/srgb from-blue-500 to-green-500">

<!-- Radial and conic gradients -->
<div class="bg-radial from-blue-500 to-transparent">
<div class="bg-conic from-blue-500 via-purple-500 to-red-500">
```

### @starting-style Variant

Entry transitions without JavaScript:

```css
@starting-style {
  .modal {
    opacity: 0;
    transform: translateY(-20px);
  }
}

.modal {
  opacity: 1;
  transform: translateY(0);
  transition: all 0.3s ease-out;
}
```

```html
<div class="opacity-0 translate-y-[-20px] transition-all starting:opacity-0 starting:translate-y-[-20px]">
```

### not-* Variant

Style elements that don't match a condition:

```html
<div class="not-hover:bg-gray-100">
<div class="not-data-active:opacity-50">
```

### Modernized Color Palette

Colors now use `oklch` for wider gamut:

```css
--color-red-500: oklch(0.635 0.242 25.623);
--color-blue-500: oklch(0.651 0.274 264.054);
--color-green-500: oklch(0.723 0.191 142.5);
```

---

## 5. Migration from v3

### Automated Upgrade

```bash
npx @tailwindcss/upgrade
```

Handles:
- Dependency updates
- Config file migration
- Template file changes
- Utility renames

### Manual Migration

| v3 | v4 |
|----|----|
| `@tailwind base;` | `@import "tailwindcss";` |
| `tailwind.config.js` | `@theme { ... }` |
| `tailwindcss` package | `@tailwindcss/vite` or `@tailwindcss/postcss` |
| `postcss-import` | Built-in |
| `autoprefixer` | Built-in |

### Utility Renames

| v3 | v4 |
|----|----|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `rounded-sm` | `rounded-xs` |
| `rounded` | `rounded-sm` |
| `blur-sm` | `blur-xs` |
| `blur` | `blur-sm` |
| `outline-none` | `outline-hidden` |
| `ring` | `ring-1` (was `ring-3`) |
| `bg-opacity-*` | `bg-*/opacity` (e.g., `bg-red-500/50`) |

### Removed Utilities

| Removed | Use Instead |
|---------|-------------|
| `bg-opacity-*` | `bg-red-500/50` |
| `text-opacity-*` | `text-red-500/50` |
| `border-opacity-*` | `border-red-500/50` |
| `flex-grow-*` | `grow-*` |
| `flex-shrink-*` | `shrink-*` |
| `overflow-ellipsis` | `text-ellipsis` |

---

## 6. Automatic Content Detection

No more `content: [...]` config:

```javascript
// v3 tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './public/index.html'],
}
```

```css
/* v4 - Automatic detection! */
@import "tailwindcss";
/* Scans your project automatically */
```

To add sources explicitly:

```css
@import "tailwindcss";
@source "../node_modules/@my-company/ui-lib";
@source "../packages/shared";
```

---

## 7. Best Practices

### Theme Organization

```css
@import "tailwindcss";

/* Design tokens first */
@theme {
  /* Brand colors */
  --color-brand-*: ...;
  
  /* Extended colors */
  --color-accent-*: ...;
  
  /* Typography scale */
  --font-*: ...;
  --text-*: ...;
  
  /* Custom utilities */
  --animate-*: ...;
}

/* Global styles after */
:root {
  --other-custom-property: value;
}

body {
  @apply bg-white text-gray-900;
}
```

### Use CSS Variables for Dynamic Values

```css
@theme {
  --color-primary: var(--brand-color);
}
```

```html
<!-- Override via JS or CSS -->
<div style="--brand-color: oklch(0.6 0.2 250)">
```

### Component Patterns

```css
@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors;
  }
}

@layer utilities {
  .text-gradient {
    @apply bg-clip-text text-transparent bg-linear-to-r;
  }
}
```

---

## 8. Performance

### Build Speed

| Metric | v3.4 | v4.0 | Improvement |
|--------|------|------|-------------|
| Full build | 378ms | 100ms | 3.78x |
| Incremental (new CSS) | 44ms | 5ms | 8.8x |
| Incremental (no new CSS) | 35ms | 192µs | 182x |

### Vite Plugin vs PostCSS

| Method | Speed |
|--------|-------|
| `@tailwindcss/vite` | Fastest (recommended) |
| `@tailwindcss/postcss` | Fast |

### CSS Layers

v4 uses native `@layer` cascade:

```css
@layer theme, base, components, utilities;
```

For custom utilities, use `@layer utilities`:

```css
@layer utilities {
  .content-visibility-auto {
    content-visibility: auto;
  }
}
```

---

## 9. Common Patterns

### Dark Mode

```css
@theme {
  --color-bg: oklch(1 0 0);
  --color-text: oklch(0.2 0 0);
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-bg: oklch(0.15 0 0);
    --color-text: oklch(0.9 0 0);
  }
}
```

### CSS-Only Theming

```css
@theme {
  --color-primary: var(--user-primary, blue);
}
```

```html
<div style="--user-primary: purple">
  Uses purple theme
</div>
```

### Extending vs Overriding

```css
@theme {
  /* Extends existing colors */
  --color-brand-500: ...;
  
  /* Overrides default (same name) */
  --color-blue-500: oklch(0.65 0.2 250);
}
```

---

## 10. Troubleshooting

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Unknown word "use strict"` | v4 syntax with v3 setup | Use `@tailwindcss/vite` plugin |
| Missing utilities | Wrong @theme namespace | Use proper namespace (`--color-*`) |
| Build slow on changes | Using PostCSS, not Vite | Switch to `@tailwindcss/vite` |

### Debug Mode

```css
@import "tailwindcss" debug;
```

---

## When to Use

Use this skill when:
- Setting up Tailwind CSS v4 in a new project
- Migrating from Tailwind v3 to v4
- Creating custom themes and design tokens
- Debugging Tailwind configuration issues
- Optimizing Tailwind build performance
- Implementing responsive/container query designs