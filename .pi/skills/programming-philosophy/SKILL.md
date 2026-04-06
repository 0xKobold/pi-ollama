---
name: programming-philosophy
description: 0xKobold's core programming philosophy. Use when writing code, reviewing PRs, or making architectural decisions. Covers DRY, KISS, functional programming, and NASA's 10 coding rules for safety-critical code.
---

# 0xKobold Programming Philosophy

> Core principles for all code in the 0xKobold ecosystem.

## Core Principles

### 1. DRY - Don't Repeat Yourself

**Every piece of knowledge must have a single, unambiguous representation.**

```typescript
// ❌ Violation: Duplicated logic
function processUser1(user: User) { return user.name.toUpperCase(); }
function processUser2(user: User) { return user.name.toUpperCase(); }

// ✅ Compliant: Single source of truth
function getDisplayName(user: User) { return user.name.toUpperCase(); }
```

**Enforce with:**
- Extract shared logic into utilities/helpers
- Use inheritance or composition for shared behavior
- Create shared types/interfaces for common data structures

---

### 2. KISS - Keep It Simple, Stupid

**Prefer the simplest solution that works.**

```typescript
// ❌ Violation: Over-engineered
class DataManager {
  private static instance: DataManager;
  private cache: Map<string, any>;
  private observers: Observer[];
  
  static getInstance(): DataManager {
    if (!this.instance) {
      this.instance = new DataManager();
    }
    return this.instance;
  }
}

// ✅ Compliant: Straightforward
function processData(data: Data[]): ProcessedData[] {
  return data.map(item => ({ ...item, processed: true }));
}
```

**Enforce with:**
- Avoid premature abstraction
- Write code that's easy to delete
- Prefer explicit over clever

---

### 3. Functional Programming Principles

**Prefer immutability and pure functions.**

```typescript
// ❌ Violation: Mutation and side effects
function addItem(list: string[], item: string): void {
  list.push(item);  // Mutates input
}

// ✅ Compliant: Pure function, immutable
function addItem(list: readonly string[], item: string): string[] {
  return [...list, item];
}
```

**Principles:**
- **Immutability**: Don't mutate inputs or global state
- **Pure functions**: Same input → same output, no side effects
- **Composition**: Build complex behavior from simple functions
- **Avoid classes**: Prefer functions and data
- **No null/undefined**: Use discriminated unions or optional chaining with defaults

```typescript
// ❌ Null checks everywhere
function getUser(id: string): User | null {
  const user = findUser(id);
  if (user !== null) {
    return user;
  }
  return null;
}

// ✅ Discriminated unions
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function getUser(id: string): Result<User> {
  const user = findUser(id);
  return user 
    ? { ok: true, value: user }
    : { ok: false, error: `User ${id} not found` };
}
```

---

## NASA 10 Coding Rules (Safety-Critical)

These rules ensure reliable, verifiable, and safe code.

### Rule 1: Avoid Complex Control Flow

**No `goto`, `setjmp`, `longjmp`, or recursion.**

```typescript
// ❌ Violation: Recursion
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// ✅ Compliant: Iteration
function factorial(n: number): number {
  let result = 1;
  for (let i = n; i > 1; i--) {
    result *= i;
  }
  return result;
}
```

---

### Rule 2: Loops Must Have Fixed Upper Bounds

**Every loop must have a compile-time verifiable limit.**

```typescript
// ❌ Violation: Unbounded while loop
while (data.length > 0) {
  process(data.pop());
}

// ✅ Compliant: Fixed iteration with guard
const MAX_ITEMS = 1000;
for (let i = 0; i < Math.min(data.length, MAX_ITEMS); i++) {
  if (data[i] === null) break;  // Explicit exit condition
  process(data[i]);
}
```

---

### Rule 3: No Dynamic Memory After Initialization

**No `new`, `malloc`, or heap allocation in running code.**

```typescript
// ❌ Violation: Dynamic allocation
function createBuffer(size: number): number[] {
  return new Array(size);  // Dynamic heap allocation
}

// ✅ Compliant: Fixed-size or pool
const MAX_BUFFER = 1024;
let buffer: number[] = [];  // Fixed pool
```

**For TypeScript/JavaScript:**
- Avoid creating objects in hot paths
- Reuse buffers/pools
- Pre-allocate arrays when size is known

---

### Rule 4: Functions Fit on One Page (~60 lines)

**Keep functions short and focused.**

```typescript
// ❌ Violation: God function
async function processEverything(data: any): Promise<void> {
  // 200 lines of everything
}

// ✅ Compliant: Composed of small functions
async function processEverything(data: Data): Promise<void> {
  const validated = validate(data);
  const normalized = normalize(validated);
  const result = await transform(normalized);
  await persist(result);
}
```

**Rule:** If a function exceeds 60 lines, it likely does too many things.

---

### Rule 5: Use At Least Two Assertions Per Function

**Defensive programming with assertions.**

```typescript
// ❌ Violation: No validation
function divide(a: number, b: number): number {
  return a / b;
}

// ✅ Compliant: Defensive checks
function divide(a: number, b: number): number {
  console.assert(typeof a === 'number', 'a must be number');
  console.assert(typeof b === 'number', 'b must be number');
  console.assert(b !== 0, 'b cannot be zero');
  
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Invalid arguments');
  }
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}
```

---

### Rule 6: Declare Data with Minimal Scope

**Keep variables as local as possible. Avoid globals.**

```typescript
// ❌ Violation: Global state
let config: Config;
function loadConfig() { config = fetchConfig(); }
function useConfig() { return config.value; }

// ✅ Compliant: Local scope, passed explicitly
function loadConfig(): Config { return fetchConfig(); }
function useConfig(config: Config) { return config.value; }
```

---

### Rule 7: Check All Return Values and Parameters

**Validate everything. Handle all errors.**

```typescript
// ❌ Violation: Ignoring return
fetchData();
processData();

// ✅ Compliant: Check returns
const data = fetchData();
if (!data) {
  throw new Error('Failed to fetch data');
}
processData(data);
```

---

### Rule 8: Limit Preprocessor to Includes and Simple Macros

**Avoid complex macros and conditional compilation.**

```typescript
// ❌ Violation: Complex macro
#define PROCESS_IF(cond, action) if (cond) { action; } else { log("failed"); }

// ✅ Compliant: Inline function
function processIf(condition: boolean, action: () => void): void {
  if (condition) {
    action();
  } else {
    console.log("failed");
  }
}
```

---

### Rule 9: Limit Pointer Usage to Single Level

**Avoid multiple levels of indirection.**

```typescript
// ❌ Violation: Double pointer
interface DoublePointer<T> { pointer: Pointer<T> }

// ✅ Compliant: Single level
interface Node<T> { value: T; next: Node<T> | null }
```

**For JavaScript/TypeScript:**
- Avoid deep property access chains
- Flatten nested objects
- Use option types instead of undefined propagation

---

### Rule 10: Compile with All Warnings Enabled

**Treat warnings as errors.**

```bash
# Enable strict TypeScript
tsc --strict --noImplicitAny --strictNullChecks

# Treat warnings as errors
tsc --noEmitOnError
```

**In `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## Applying These Rules

### Before Writing Code

1. Does this violate DRY? Is there existing logic I can reuse?
2. Is this the simplest solution? (KISS)
3. Am I mutating state? Can I make this pure?
4. Does this follow NASA's rules?

### Code Review Checklist

- [ ] No duplicated logic (DRY)
- [ ] Simple, readable implementation (KISS)
- [ ] Pure functions, no mutation (FP)
- [ ] No recursion or complex control flow (NASA #1)
- [ ] Fixed loop bounds (NASA #2)
- [ ] No dynamic allocation in hot paths (NASA #3)
- [ ] Functions ≤60 lines (NASA #4)
- [ ] Assertions present (NASA #5)
- [ ] Minimal variable scope (NASA #6)
- [ ] All returns/params validated (NASA #7)
- [ ] No complex macros (NASA #8)
- [ ] Single-level access (NASA #9)
- [ ] Clean compilation (NASA #10)

---

## Examples from 0xKobold

### Good Pattern: Pure function with validation

```typescript
interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

function validateConfig(config: unknown): ValidationResult {
  console.assert(config !== null, 'config cannot be null');
  console.assert(typeof config === 'object', 'config must be object');
  
  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['Config must be an object'] };
  }
  
  // ... validation logic
  
  return { valid: true };
}
```

### Good Pattern: Immutable data transformation

```typescript
function mergeConfig(base: Config, override: Partial<Config>): Config {
  return { ...base, ...override };
}

function processMessages(messages: readonly Message[]): ProcessedMessage[] {
  return messages
    .filter(msg => msg.role === 'user')
    .map(msg => ({ ...msg, processed: true }));
}
```

### Bad Pattern: Global state

```typescript
// ❌ Global mutable state
let currentSession: Session | null = null;

function setSession(s: Session) { currentSession = s; }
function getSession() { return currentSession; }

// ✅ Explicit context passing
function createSessionManager(initial: Session) {
  let session = initial;
  
  return {
    get: () => session,
    set: (s: Session) => { session = s; }
  };
}
```
