# @comfyorg/extension-api

> **Status**: scaffolded. Package implementation pending PKG3 — see
> `../../../plans/P2-extension-api-package.md` and
> `../../../plans/prompts/PKG3-npm-package.md` in the workspace root.

The official TypeScript declaration package for ComfyUI extensions. This
package replaces the practice of vendoring `comfy.d.ts` files in custom
node repos.

## Install (post-publish)

```bash
pnpm add -D @comfyorg/extension-api
```

```ts
import { defineExtension } from '@comfyorg/extension-api'

export default defineExtension({
  name: 'MyExtension',
  setup(ctx) {
    ctx.onNodeMounted((node) => {
      // ...
    })
  }
})
```

## Source

This package is built from the source-of-truth folder
`../../src/extension-api/`. Do not edit the package's `build/` output
directly.

## Versioning

- `0.x.y` — experimental during parallel-paths transition (D6 Phase A).
- `1.0.0` — first stable release once D5/D6/D7/D8 are accepted and the
  surface has stabilized.
- Breaking changes follow semver strictly from `1.0.0` onward.

## Cross-references

- `decisions/D6-parallel-paths-migration.md` — versioning rationale
- `plans/P2-extension-api-package.md` — package structure plan
- `plans/prompts/PKG3-npm-package.md` — implementation prompt
- `plans/prompts/PKG4-ci-workflows.md` — publish workflow
- `plans/prompts/PKG5-docgen-mdx.md` — docgen pipeline
- `plans/prompts/PKG6-docs-comfy-org.md` — docs.comfy.org integration
