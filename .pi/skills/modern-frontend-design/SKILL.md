---
name: modern-frontend-design
description: "Create distinctive, production-grade frontend interfaces that avoid generic AI aesthetics. Typography, motion, layout, and visual polish principles."
risk: safe
source: research
date_added: "2026-03-16"
---

# Modern Frontend Design

> Create distinctive, production-grade interfaces that avoid generic "AI slop" aesthetics.

---

## 1. Design Thinking Process

### Before Coding

Ask these questions:

1. **Purpose**: What problem does this interface solve? Who uses it?
2. **Tone**: What emotional response should it evoke?
3. **Context**: Where will users interact with it?
4. **Differentiation**: What makes this UNFORGETTABLE?

### Aesthetic Commitment

**CRITICAL**: Choose ONE clear direction and execute fully.

| Direction | Characteristics |
|-----------|-----------------|
| Brutally minimal | Maximum restraint, extreme whitespace |
| Maximalist chaos | Dense, layered, overwhelming (intentionally) |
| Retro-futuristic | Nostalgic tech meets modern capability |
| Organic/natural | Flowing, imperfect, human-feeling |
| Luxury/refined | Premium, sophisticated, sparse elegance |
| Brutalist/raw | Exposed structure, industrial elements |
| Art deco/geometric | Bold shapes, symmetrical, structured |
| Playful/toy-like | Rounded, bouncy, fun interactions |
| Editorial/magazine | Typography-forward, grid-based |
| Industrial/utilitarian | Functional, purpose-driven |
| Soft/pastel | Gentle gradients, rounded corners |

---

## 2. Typography

### Characterful Font Choices

| Avoid (Overused) | Try Instead |
|------------------|-------------|
| Inter | Space Grotesk, DM Sans, Satoshi |
| Roboto | DM Sans, Outfit, Plus Jakarta Sans |
| Arial | IBM Plex Sans, Manrope, Sora |
| System fonts | Carefully chosen web fonts |
| Space Grotesk | (Already too common, find alternatives) |

### Distinctive Display Fonts

| Style | Fonts |
|-------|-------|
| Editorial | Playfair Display, Lora, Merriweather |
| Geometric | Archivo Black, Lilex, Cabinet Grotesk |
| Technical | JetBrains Mono, Fira Code, IBM Plex Mono |
| Playful | Poppins, Nunito, Quicksand |
| Luxury | Cormorant, Libre Baskerville, Cormorant Garamond |
| Bold/headline | Cal Sans, Clash Display, Montserrat Extra |
| Retro | Archivo Narrow, Oswald, Barlow Condensed |

### Pairing Guidelines

```css
/* Minimal pairing */
font-family: "Cal Sans", system-ui, sans-serif;  /* Display */
font-family: "Inter", system-ui, sans-serif;      /* Body (only if appropriate) */

/* Better approach */
--font-display: "Clash Display", "Satoshi", sans-serif;
--font-body: "Satoshi", system-ui, -apple-system, sans-serif;
--font-mono: "JetBrains Mono", "IBM Plex Mono", monospace;
```

### Type Scale

```css
/* Fluid typography with clamp */
--text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
--text-sm: clamp(0.875rem, 0.8rem + 0.375vw, 1rem);
--text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
--text-lg: clamp(1.125rem, 1rem + 0.625vw, 1.5rem);
--text-xl: clamp(1.5rem, 1.2rem + 1.5vw, 2rem);
--text-2xl: clamp(2rem, 1.5rem + 2.5vw, 3rem);
--text-3xl: clamp(3rem, 2rem + 5vw, 5rem);
```

---

## 3. Color & Theme

### Commit to a Palette

| Approach | Use When |
|----------|-----------|
| Monochromatic | Minimal, sophisticated, luxury |
| Complementary | Bold contrast, memorable |
| Analogous | Harmonious, calm, nature-inspired |
| Triadic | Playful, energetic |
| Dark mode primary | Developer tools, dashboards, apps |
| Light mode primary | Content sites, marketing, blogs |

### Modern Color Formats

```css
/* Use OKLCH for better color space */
@theme {
  --color-brand-50: oklch(0.98 0.01 250);
  --color-brand-100: oklch(0.95 0.03 250);
  --color-brand-500: oklch(0.65 0.15 250);
  --color-brand-900: oklch(0.30 0.08 250);
}

/* Fallback for older browsers */
:root {
  --color-brand-500: hsl(250, 85%, 60%);
  --color-brand-500: oklch(0.65 0.15 250);
}
```

### Anti-Patterns

| ❌ Avoid | ✅ Instead |
|----------|-----------|
| Purple gradients on white | Intentional color story |
| Generic "corporate blue" | Brand-appropriate palette |
| Even distribution of colors | Dominant color with accents |
| Pure black/white | Soft alternatives (#0a0a0a, #fafafa) |

---

## 4. Motion & Animation

### Principles

| Principle | Implementation |
|-----------|----------------|
| Purposeful | Every animation serves the user |
| Performant | Use transform, opacity only |
| Subtle | Micro-interactions enhance, not distract |
| Orchestrated | Staggered reveals, cohesive timing |

### CSS-First Approach

```css
/* Hover states */
.card {
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

/* Focus states */
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Page load animation */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: fadeInUp 0.5s ease-out forwards;
}

/* Staggered delays */
.item:nth-child(1) { animation-delay: 0ms; }
.item:nth-child(2) { animation-delay: 50ms; }
.item:nth-child(3) { animation-delay: 100ms; }
```

### Tailwind v4 Motion

```html
<!-- Hover + focus -->
<button class="transition-all duration-200 hover:scale-105 focus-visible:ring-2">
  Click me
</button>

<!-- Staggered animation list -->
<ul>
  <li class="animate-fade-in" style="animation-delay: 0ms">First</li>
  <li class="animate-fade-in" style="animation-delay: 50ms">Second</li>
  <li class="animate-fade-in" style="animation-delay: 100ms">Third</li>
</ul>

<!-- prefers-reduced-motion -->
<div class="motion-safe:hover:scale-105 motion-reduce:hover:scale-100">
  <img src="..." />
</div>
```

### React Motion Patterns

```tsx
import { motion } from "motion/react";

// Motion library (Framer Motion)
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
>
  Content
</motion.div>

// Stagger children
<motion.ul
  initial="hidden"
  animate="visible"
  variants={{
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.05 }
    }
  }}
>
  {items.map((item) => (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {item}
    </motion.li>
  ))}
</motion.ul>
```

---

## 5. Spatial Composition

### Layout Principles

| Principle | Application |
|-----------|-------------|
| Asymmetry | Dynamic, interesting balance |
| Overlap | Layered depth, visual interest |
| Grid-breaking | Surprise elements that stand out |
| Generous space OR controlled density | Pick one, commit fully |
| Diagonal flow | Guide eye intentionally |

### Modern Layouts

```css
/* Asymmetric hero */
.hero {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 4rem;
}

/* Overlapping sections */
.feature-card {
  position: relative;
  z-index: 10;
  margin-top: -4rem;
}

/* Layered depth */
.background {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  filter: blur(100px);
}
```

### Spacing Scale

```css
@theme {
  --spacing: 0.25rem; /* Base unit */
}

/* Then use Tailwind's spacing */
<div class="p-4">     /* 1rem */
<div class="p-8">     /* 2rem */
<div class="p-16">    /* 4rem */
<div class="p-24">    /* 6rem */
```

---

## 6. Background & Visual Details

### Atmosphere Creation

| Technique | Use Case |
|------------|----------|
| Gradient meshes | Subtle depth |
| Noise textures | Organic feel |
| Geometric patterns | Technical aesthetic |
| Layered transparencies | Depth without weight |
| Dramatic shadows | Dimension |
| Decorative borders | Refinement |
| Grain overlays | Premium feel |
| Custom cursors | Playful interaction |

### CSS Techniques

```css
/* Gradient mesh background */
.mesh-bg {
  background: 
    radial-gradient(at 40% 20%, oklch(0.65 0.15 250) 0px, transparent 50%),
    radial-gradient(at 80% 0%, oklch(0.65 0.15 320) 0px, transparent 50%),
    radial-gradient(at 0% 50%, oklch(0.65 0.15 180) 0px, transparent 50%),
    oklch(0.1 0 0);
}

/* Noise texture overlay */
.noise::before {
  content: "";
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,...") repeat;
  opacity: 0.05;
  pointer-events: none;
}

/* Glassmorphism */
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Glow effect */
.glow {
  box-shadow: 
    0 0 20px var(--color-brand-500),
    0 0 40px var(--color-brand-500);
}
```

---

## 7. Accessibility Foundations

### Essential Requirements

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | WCAG AA (4.5:1 for text) |
| Focus indicators | Visible focus-visible styles |
| Keyboard navigation | Tab order, skip links |
| Screen reader support | Semantic HTML, aria labels |
| Motion preferences | prefers-reduced-motion |

### Semantic Structure

```html
<!-- Landmarks -->
<header role="banner">
<nav role="navigation" aria-label="Main navigation">
<main role="main">
<aside role="complementary">
<footer role="contentinfo">

<!-- Headings hierarchy -->
<h1>Page Title</h1>
  <h2>Section Title</h2>
    <h3>Subsection Title</h3>

<!-- Interactive elements -->
<button aria-label="Close menu">
<a aria-label="Learn more about our services">
<input aria-describedby="password-hint">
```

---

## 8. Anti-Patterns to Avoid

### Generic AI Aesthetics

| ❌ Anti-Pattern | Why It's Bad |
|-----------------|--------------|
| Inter font everywhere | Ubiquitous, personality-free |
| Purple gradients | Cliché, dated immediately |
| Cards with rounded corners + subtle shadow | Default Figma aesthetic |
| Hero section with gradient text | Overdone |
| Even padding everywhere | Static, boring |
| Safe color palettes | Forgettable |

### Better Approaches

| ✅ Instead | Why It's Better |
|------------|-----------------|
| Distinctive display fonts | Creates memorable identity |
| Bold, unusual colors | Stands out, memorable |
| Asymmetric layouts | Dynamic, engaging |
| One memorable visual moment | Creates hook |
| Intentional whitespace OR density | Commits to aesthetic |

---

## 9. Component Patterns

### Buttons

```css
/* Modern button states */
.btn {
  /* Base */
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
  
  /* States */
  &:hover { transform: translateY(-1px); }
  &:active { transform: translateY(0); }
  &:focus-visible { 
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

/* Primary */
.btn-primary {
  background: var(--color-primary);
  color: white;
}

/* Secondary */
.btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
```

### Cards

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: box-shadow 0.2s, transform 0.2s;
}

.card:hover {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  width: 100%;
  
  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
  }
  
  &::placeholder {
    color: var(--color-text-muted);
  }
}
```

---

## When to Use

Use this skill when:
- Creating new UI components or pages
- Designing user interfaces from scratch
- Reviewing for generic AI aesthetics
- Building distinctive brand experiences
- Implementing motion and animation
- Setting up typography systems

---

> **Remember:** Bold maximalism and refined minimalism both work. The key is intentionality and commitment to the chosen aesthetic. Don't hold back—show what can truly be created.