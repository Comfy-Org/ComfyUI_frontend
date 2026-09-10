/// <reference path="../.astro/types.d.ts" />

// Opting into Vite's strict mode drops the `[key: string]: any` fallback on
// ImportMetaEnv, so an undeclared `import.meta.env.X` is a compile error
// instead of a silent `any`.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly PUBLIC_POSTHOG_KEY?: string
  readonly PUBLIC_POSTHOG_API_HOST?: string
  readonly PUBLIC_POSTHOG_UI_HOST?: string
  readonly PUBLIC_CUSTOMERIO_WRITE_KEY?: string
}

// `astro check` resolves `.astro` imports through its own language server, but
// `vue-tsc` (plain tsc plus the Vue plugin) has no resolver for the extension
// at all, so a `.ts` file that imports an `.astro` component -- e.g.
// src/components/engineering-blog/diagrams/registry.ts -- fails with
// TS2307 under `pnpm typecheck` even though the app builds fine.
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js'

  const Component: AstroComponentFactory
  export default Component
}
