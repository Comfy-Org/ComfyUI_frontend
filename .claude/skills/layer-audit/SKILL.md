---
name: layer-audit
description: 'Detect violations of the layered architecture import rules (base -> platform -> workbench -> renderer). Runs ESLint with the import-x/no-restricted-paths rule and generates a grouped report.'
---

# Layer Architecture Audit

Finds imports that violate the layered architecture boundary rules enforced by `import-x/no-restricted-paths` in `eslint.config.ts`.

## Layer Hierarchy (bottom to top)

```
renderer  (top -- can import from all lower layers)
   ^
workbench
   ^
platform
   ^
  base    (bottom -- cannot import from any upper layer)
```

Each layer may only import from layers below it.

## How to Run

```bash
# Run ESLint filtering for just the layer boundary rule violations
pnpm lint 2>&1 | grep 'import-x/no-restricted-paths' -B1 | head -200
```

To get a full structured report, run:

```bash
# Collect all violations from base/, platform/, workbench/ layers
pnpm eslint src/base/ src/platform/ src/workbench/ --no-error-on-unmatched-pattern --rule '{"import-x/no-restricted-paths": "warn"}' --format compact 2>&1 | grep 'no-restricted-paths' | sort
```

## How to Read Results

Each violation line shows:

- The **file** containing the bad import
- The **import path** crossing the boundary
- The **message** identifying which layer pair is violated

### Grouping by Layer Pair

After collecting violations, group them by the layer pair pattern:

| Layer pair            | Meaning                             |
| --------------------- | ----------------------------------- |
| base -> platform      | base/ importing from platform/      |
| base -> workbench     | base/ importing from workbench/     |
| base -> renderer      | base/ importing from renderer/      |
| platform -> workbench | platform/ importing from workbench/ |
| platform -> renderer  | platform/ importing from renderer/  |
| workbench -> renderer | workbench/ importing from renderer/ |

## When to Use

- Before creating a PR that adds imports between `src/base/`, `src/platform/`, `src/workbench/`, or `src/renderer/`
- When auditing the codebase to find and plan migration of existing violations
- After moving files between layers to verify no new violations were introduced

## Fixing Violations

Common strategies to resolve a layer violation:

1. **Move the import target down** -- if the imported module doesn't depend on upper-layer concepts, move it to a lower layer
2. **Introduce an interface** -- define an interface/type in the lower layer and implement it in the upper layer via dependency injection or a registration pattern
3. **Move the importing file up** -- if the file logically belongs in a higher layer, relocate it
4. **Extract shared logic** -- pull the shared functionality into `base/` or a shared utility

## Reference

| Resource                        | Path               |
| ------------------------------- | ------------------ |
| ESLint config (rule definition) | `eslint.config.ts` |
| Base layer                      | `src/base/`        |
| Platform layer                  | `src/platform/`    |
| Workbench layer                 | `src/workbench/`   |
| Renderer layer                  | `src/renderer/`    |
