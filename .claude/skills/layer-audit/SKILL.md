---
name: layer-audit
description: 'Detect violations of the layered architecture import rules (base -> platform -> workbench -> renderer). Runs oxlint with the comfy/no-restricted-paths rule and generates a grouped report.'
---

# Layer Architecture Audit

Finds imports that violate the layer boundaries enforced by `comfy/no-restricted-paths` (`tools/oxlint-plugins/importPaths.ts`). The zones and their messages are configured in `.oxlintrc.json`: each layer in `base → platform → workbench → renderer` may import only from layers below it.

## When to Use

- Before creating a PR that adds imports between `src/base/`, `src/platform/`, `src/workbench/`, or `src/renderer/`
- When auditing the codebase to plan migration of existing violations
- After moving files between layers

## How to Run

Lint only the restricted layers; the oxlint config applies the rule:

```bash
pnpm exec oxlint src/base/ src/platform/ src/workbench/ --format=json \
  | jq -r '.diagnostics[] | select(.code == "comfy(no-restricted-paths)") | "\(.filename):\(.labels[0].span.line) \(.message)"' | sort
```

An empty list means no violations only when the command printed no errors. If oxlint fails to run, it writes the failure to stderr and no JSON, and the list is empty too.

Each line names the file, the line of the offending import, and the zone message, which states the layer pair. Group the results by that message.

## Fixing Violations

1. **Move the import target down** -- if the imported module doesn't depend on upper-layer concepts, move it to a lower layer
2. **Introduce an interface** -- define an interface/type in the lower layer and implement it in the upper layer via dependency injection or a registration pattern
3. **Move the importing file up** -- if the file logically belongs in a higher layer, relocate it
4. **Extract shared logic** -- pull the shared functionality into `base/` or a shared utility
