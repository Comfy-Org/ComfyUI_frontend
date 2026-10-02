# @comfyorg/oxlint-config

Native Oxlint rules shared by Comfy repositories. Type-only imports use separate
top-level `import type` declarations; mixed and inline type specifiers are rejected.

Install this package with Oxlint 1.77 or newer, then extend its generated JSON:

```json
{
  "extends": ["./node_modules/@comfyorg/oxlint-config/dist/imports.json"]
}
```

TypeScript configs can import the same preset:

```ts
import imports from '@comfyorg/oxlint-config/imports'
import { defineConfig } from 'oxlint'

export default defineConfig({ extends: [imports] })
```

Repository overrides, ignores and custom plugins stay local. When combining
Oxlint and ESLint, keep the Oxlint rule-disabling adapter so these import checks
run once. Vue template rules, including `vue/no-use-v-else-with-v-for`, remain in
ESLint because Oxlint does not parse Vue templates. Oxlint also skips automatic
type-only conversion in Vue scripts to preserve values referenced by templates.

`pnpm build` emits ESM, declarations and JSON from one TypeScript preset.
Frontend's postinstall script builds the preset and extends its workspace artifact
directly. npm consumers use the installed-package path above. `pnpm pack` runs
the same build. Initial publication is `0.1.0-alpha.0` on npm's `next` tag,
after merge through the existing main-only publish workflow.
