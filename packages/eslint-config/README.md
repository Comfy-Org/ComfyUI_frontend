# @comfyorg/eslint-config

Shared import and Vue policies for ESLint 9 and 10. Consumers supply their
existing parsers and plugins; repository-specific rules stay local. These are
rule-only presets: they do not register plugins, change parsers, or select files.

```ts
import imports from '@comfyorg/eslint-config/imports'
import vue from '@comfyorg/eslint-config/vue'

export default [...localConfig, imports(), vue]
```

The import preset requires `@typescript-eslint` and `import-x` plugin namespaces.
Nuxt registers import-x as `import`, so use `imports('import')` with `withNuxt`.
The Vue preset requires the `vue` plugin and `vue-eslint-parser`.

Type-only symbols must use separate top-level `import type` declarations. Runtime
imports remain runtime imports, including symbols used by Vue templates. Move
`v-else` and `v-else-if` onto a wrapper when their child has `v-for`.

Oxlint supports Vue SFC script blocks, but not full template analysis or
`eslint-plugin-vue` compatibility. Keep ESLint and `vue-eslint-parser` for
template checks; see [Oxc #15761](https://github.com/oxc-project/oxc/issues/15761).

Frontend keeps its current hybrid setup: these presets precede the Oxlint
adapter, which disables overlapping import rules while retaining Vue template
checks. This package does not replace `eslint-plugin-vue`'s recommended config
or Frontend's template-aware unused-import checks.

For an ESLint-only consumer, apply both presets after the framework config.
Nuxt example:

```ts
export default withNuxt(imports('import'), vue)
```

To move import enforcement back to ESLint in a hybrid consumer, remove the two
import rules from Oxlint, then place `imports()` after the rule-disabling
adapter. Validate that consumer's existing violations before switching. The
presets inherit options already supplied by the framework, including Nuxt's
`disallowTypeAnnotations: false`; they do not force native Oxlint's defaults.

Pack with `pnpm pack`; its manifest exports compiled JavaScript and declarations.
Workspace imports use the TypeScript sources. The first release is
`0.1.0-alpha.0` on the npm `next` tag, after this package is merged and approved.
