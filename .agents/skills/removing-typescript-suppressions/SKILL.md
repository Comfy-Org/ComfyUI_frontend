---
name: removing-typescript-suppressions
description: Replaces @ts-expect-error and @ts-ignore directives with minimal type-safe fixes. Use when removing TypeScript compiler suppressions.
---

# Removing TypeScript suppressions

Replace suppressions by repairing the contract that caused the compiler error.
Do not silence the error elsewhere or widen types beyond the real runtime shape.

## Workflow

### 1. Establish the scope

Read `docs/guidance/typescript.md`, `docs/guidance/engineering.md`, and the
guidance for the affected files. Identify the correct comparison ref and list
only suppressions introduced by the change under review:

```bash
git diff --unified=2 <base-ref>...HEAD -- <paths> \
  | rg -n '^\+.*@ts-(expect-error|ignore)|^diff --git|^@@'
```

Do not expand the task to old suppressions unless the user asks. Preserve a
suppression used deliberately to test a compiler error when that error is the
behavior under test.

### 2. Read the ownership path

Read each affected file and trace the value to its source type, runtime owner,
and consumers. Check declarations, store types, generated API types, library
return types, test globals, and the relevant `tsconfig` before choosing a fix.

Do not accept the suppression comment as the diagnosis. Verify the failing code
path and runtime shape.

### 3. Expose the real errors

Remove the in-scope suppressions, then run the narrowest typecheck that owns the
files. Use the compiler diagnostics to group failures by root cause instead of
patching each line independently.

Common commands in this repository:

```bash
pnpm typecheck
pnpm typecheck:browser
pnpm typecheck:scripts
pnpm typecheck:website
```

### 4. Repair the contract

Prefer, in order:

1. correct types at the source
2. control-flow narrowing
3. an existing domain type or generated API type
4. `unknown` at a genuine compatibility boundary, followed by runtime narrowing

Avoid `any`, `as any`, a replacement assertion, a broader optional type, or a
new wrapper that merely hides the mismatch. Keep public API types stable and do
not expose internal store types through public facades.

### 5. Verify behavior and absence

Run the owning typecheck, focused tests, lint, formatting, and a whitespace
check. Use `pnpm exec vitest run` for Vitest, `pnpm test:browser:local` or
`pnpm test:browser` for Playwright, and the owning repository script for other
test types. Confirm that the diff adds no suppression:

```bash
pnpm exec eslint <changed-files>
pnpm exec oxfmt --check <changed-files>
git diff --check <base-ref>...HEAD -- <paths>
git diff --unified=0 <base-ref>...HEAD -- <paths> \
  | rg '^\+.*@ts-(expect-error|ignore)'
```

The final `rg` command should return no matches. Run broader checks when the fix
changes a shared type, public contract, store, or cross-package boundary.

## Repair patterns

### Narrow optional browser globals once

Copy an optional global to a local and guard it. This preserves narrowing across
callbacks and asynchronous code.

```typescript
const app = window.app
if (!app) throw new Error('ComfyUI app is not initialized')

await app.api.getNodeDefs()
```

### Use the owner instead of casting a facade

When a public facade intentionally omits internal collections, import the store
or service that owns those collections. Do not widen the facade or cast through
it for one caller.

### Narrow value-or-factory unions

Resolve callbacks before using their values:

```typescript
const label =
  typeof command.label === 'function' ? command.label() : command.label
```

Resolve a factory default before passing it to another resolver. Keep untyped
legacy data as `unknown`. Narrow objects before reading properties, functions
before calling them, and returned values before use.

### Read map identity from `Object.entries`

If an object's key is the identifier, do not invent an `id` property on its
values:

```typescript
Object.entries(dialogs).map(([id, dialog]) => ({ id, title: dialog.title }))
```

### Handle nullable factories before dereferencing

Respect library return types such as `LiteGraph.createNode(): LGraphNode | null`:

```typescript
const node = liteGraph.createNode(nodeName, displayName)
if (!node?.widgets?.length) return {}
```

Use optional chaining only when the missing value and the empty value have the
same behavior. Otherwise, use a guard with a useful error.

### Use named payloads across callback boundaries

Heterogeneous array arguments often lose positional types in `page.evaluate`
and similar APIs. Pass an object instead of asserting a tuple:

```typescript
await page.evaluate(
  ({ nodeName, displayName, inputNames }) => {
    // use the independently typed fields
  },
  { nodeName, displayName, inputNames }
)
```

### Validate serialization boundaries

Type values produced by code you own before passing them to
`Object.fromEntries`. If JSON or browser data arrives as `unknown`, validate its
full nested shape before assigning a domain type. A result annotation does not
validate data.

### Make test preconditions executable

If a test needs optional output, narrow it with a runtime guard that produces a
clear behavioral failure:

```typescript
if (!serialized.inputs || !serialized.outputs) {
  throw new Error('Expected serialized node labels')
}
```

Do not replace the suppression with a non-null assertion.

### Install minimal test globals without claiming full DOM types

When Node tests need a small browser shim, add the property to the host object
instead of assigning `{}` to a full `Window` type:

```typescript
if (typeof window === 'undefined') {
  Object.assign(globalThis, { window: {} })
}
```

### Delete documentation-only values

If strict checking reports an unused constant kept only as documentation,
delete it. Put useful context on the value that the code actually checks.

## Guardrails

- Do not hand-declare server response types. Import generated shared types.
- Do not grow `ExtensionManager` or another public API to expose private state.
- Put reusable type guards in leaf modules with runtime-free `import type`
  dependencies.
- Do not change runtime behavior while repairing types unless the old code was
  demonstrably inconsistent with its runtime contract. Cover such a bug with a
  focused test.
- Treat review findings and their proposed fixes as claims. Reproduce the error
  against current code, then fix or reject each finding with concrete evidence.
