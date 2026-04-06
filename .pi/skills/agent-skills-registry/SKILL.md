---
name: agent-skills-registry
description: "Curated registry of high-quality agent skills and tools. Use for discovering and installing capabilities for AI agents."
risk: safe
source: research
date_added: "2026-03-16"
---

# Agent Skills Registry

> Curated collection of useful agent skills from skills.sh and major repositories.

---

## 1. Installing Skills

### Skills CLI

```bash
# Install a skill
npx skills add owner/repo

# Install specific skill from multi-skill repo
npx skills add vercel-labs/agent-skills react-best-practices
```

### Manual Installation

```bash
# Clone or download skill
git clone https://github.com/owner/skills.git

# Copy to your skills directory
cp -r skills/skill-name ~/.skills/
```

---

## 2. Top Skills Leaderboard

### Development Standards (100K+ installs)

| Skill | Source | Use When |
|-------|--------|----------|
| `find-skills` | vercel-labs/skills | Discover relevant skills for a task |
| `vercel-react-best-practices` | vercel-labs/agent-skills | Building React/Next.js apps |
| `web-design-guidelines` | vercel-labs/agent-skills | UI/UX review and auditing |
| `frontend-design` | anthropics/skills | Creating distinctive web interfaces |

### Database & Backend

| Skill | Source | Use When |
|-------|--------|----------|
| `supabase-postgres-best-practices` | supabase/agent-skills | PostgreSQL optimization |
| `better-auth-best-practices` | better-auth/skills | Authentication implementation |

### Framework-Specific

| Skill | Source | Use When |
|-------|--------|----------|
| `next-best-practices` | vercel-labs/next-skills | Next.js optimization |
| `remotion-best-practices` | remotion-dev/skills | Video generation |
| `shadcn` | shadcn/ui | Component library usage |

### Testing & QA

| Skill | Source | Use When |
|-------|--------|----------|
| `audit-website` | squirrelscan/skills | Security/performance audits |
| `systematic-debugging` | obra/superpowers | Debugging methodology |
| `test-driven-development` | obra/superpowers | TDD workflow |

### Workflow & Planning

| Skill | Source | Use When |
|-------|--------|----------|
| `writing-plans` | obra/superpowers | Creating implementation plans |
| `executing-plans` | obra/superpowers | Following plans step-by-step |
| `subagent-driven-development` | obra/superpowers | Multi-agent workflows |

---

## 3. Vercel Agent Skills Details

### react-best-practices

40+ rules across 8 categories for React/Next.js:

| Category | Priority | Key Rules |
|----------|----------|-----------|
| Eliminating waterfalls | Critical | Parallel data fetching, suspense boundaries |
| Bundle size | Critical | Dynamic imports, code splitting |
| Server-side perf | High | Streaming, caching strategies |
| Client data fetching | Medium-High | SWR, React Query patterns |
| Re-render optimization | Medium | Memo patterns, dependency arrays |
| Rendering perf | Medium | Virtualization, layout thrashing |
| JS micro-optimizations | Low-Medium | Avoid inline functions, stable references |

### web-design-guidelines

100+ rules for web interface audits:

| Category | Focus Areas |
|----------|-------------|
| Accessibility | aria-labels, semantic HTML, keyboard navigation |
| Focus States | visible focus, focus-visible patterns |
| Forms | autocomplete, validation, error handling |
| Animation | prefers-reduced-motion, compositor transforms |
| Typography | curly quotes, ellipsis, tabular numbers |

---

## 4. Anthropic Skills Details

### frontend-design

Create distinctive, production-grade interfaces:

**Design Thinking Process:**
1. Understand purpose and audience
2. Choose bold aesthetic direction
3. Implement working code with attention to detail

**Aesthetic Directions:**
- Brutally minimal
- Maximalist chaos
- Retro-futuristic
- Organic/natural
- Luxury/refined
- Brutalist/raw
- Art deco/geometric
- Industrial/utilitarian

**Typography Guidelines:**
- Avoid Inter, Roboto, Arial (overused)
- Choose distinctive fonts matching aesthetic
- Pair display font with refined body font

**Motion Principles:**
- CSS-only for HTML projects
- Motion library for React
- Staggered reveals over scattered effects
- Scroll-triggering and surprising hovers

**Anti-Patterns to Avoid:**
- Purple gradients on white
- Inter font everywhere
- Generic layouts
- Cookie-cutter patterns

---

## 5. obra/superpowers Collection

Workflow-oriented skills:

### systematic-debugging
1. Gather evidence
2. Form hypothesis
3. Design experiment
4. Execute and analyze
5. Iterate or solve

### writing-plans
1. Understand requirements
2. Break into phases
3. Define milestones
4. Identify dependencies
5. Estimate effort

### executing-plans
1. Execute steps sequentially
2. Validate each step
3. Handle blockers
4. Update progress tracking

---

## 6. Creating Custom Skills

### Skill Structure

```
my-skill/
├── SKILL.md          # Main skill file (required)
├── templates/        # Optional templates
├── examples/         # Optional examples
└── resources/         # Optional resources
```

### SKILL.md Format

```markdown
---
name: my-skill
description: "What this skill does"
risk: safe | medium | high
source: custom
date_added: "2026-03-16"
---

# Skill Name

Brief description of the skill.

## Section 1
Content...

## Section 2
Content...
```

### Risk Levels

| Level | Description |
|-------|-------------|
| `safe` | Read-only, math, string operations |
| `medium` | File writes, HTTP requests |
| `high` | Shell commands, deletions, system changes |

---

## 7. Skill Categories

### By Function

| Category | Examples |
|----------|----------|
| **Code Quality** | linting-rules, code-review, refactoring |
| **Architecture** | system-design, api-design, database-design |
| **Framework** | nextjs, react-native, vue-best-practices |
| **Testing** | tdd, e2e-testing, unit-testing |
| **DevOps** | ci-cd, deployment, monitoring |
| **Security** | owasp-audit, dependency-check, secrets-scanning |
| **Performance** | bundle-optimization, caching-strategies |
| **Documentation** | readme-template, api-docs, changelog |

### By Domain

| Domain | Skills |
|--------|--------|
| Frontend | react-best-practices, tailwind, accessibility |
| Backend | rest-api-design, graphql-patterns, microservices |
| Database | postgres-optimization, redis-patterns |
| DevOps | docker-best-practices, k8s-deployment |
| AI/ML | prompt-engineering, rag-patterns |

---

## 8. When to Use Which Skill

### Starting a Project
1. `writing-plans` - Create implementation plan
2. `system-design` - Architecture decisions
3. `framework-best-practices` - Project setup

### During Development
1. `code-review` - Quality checks
2. `testing-patterns` - Test coverage
3. `debugging` - Bug fixing

### Before Deployment
1. `audit-website` - Security/perf check
2. `accessibility` - A11y compliance
3. `performance-optimization` - Bundle analysis

### Code Review Workflow
1. `systematic-debugging` - Fix issues found
2. `refactoring-patterns` - Improve code quality
3. `documentation` - Update docs

---

## When to Use

Use this skill when:
- Discovering new agent skills to install
- Setting up a new project with proper standards
- Auditing existing code against best practices
- Creating custom skills for your workflow
- Searching for solutions to common problems

---

## Installation Commands

```bash
# Vercel skills
npx skills add vercel-labs/agent-skills react-best-practices
npx skills add vercel-labs/agent-skills web-design-guidelines

# Anthropic skills
npx skills add anthropics/skills frontend-design
npx skills add anthropics/skills pdf
npx skills add anthropics/skills docx

# obra/superpowers
npx skills add obra/superpowers systematic-debugging
npx skills add obra/superpowers writing-plans

# Other useful skills
npx skills add shadcn/ui shadcn
npx skills add supabase/agent-skills supabase-postgres-best-practices
```