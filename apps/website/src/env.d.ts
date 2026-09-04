/// <reference path="../.astro/types.d.ts" />

// Opting into Vite's strict mode drops the `[key: string]: any` fallback on
// ImportMetaEnv, so an undeclared `import.meta.env.X` is a compile error
// instead of a silent `any`.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  /** LOCAL ONLY: route runs through the vendored partner bundle. */
  readonly PUBLIC_WORKSHOP_PARTNER_PROXY?: string
  readonly PUBLIC_POSTHOG_KEY?: string
  readonly PUBLIC_POSTHOG_API_HOST?: string
  readonly PUBLIC_POSTHOG_UI_HOST?: string
  readonly PUBLIC_CUSTOMERIO_WRITE_KEY?: string
}
