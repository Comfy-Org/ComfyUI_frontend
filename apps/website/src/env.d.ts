/// <reference path="../.astro/types.d.ts" />

// Opting into Vite's strict mode drops the `[key: string]: any` fallback on
// ImportMetaEnv, so an undeclared `import.meta.env.X` is a compile error
// instead of a silent `any`.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  /** 'staging' points every Workshop backend at the staging family. */
  readonly PUBLIC_WORKSHOP_CLOUD_ENV?: string
  /** '1' forces the Workshop auth flag on — PostHog only runs in PROD builds. */
  readonly PUBLIC_WORKSHOP_AUTH_FLAG?: string
  readonly PUBLIC_POSTHOG_KEY?: string
  readonly PUBLIC_POSTHOG_API_HOST?: string
  readonly PUBLIC_POSTHOG_UI_HOST?: string
  readonly PUBLIC_CUSTOMERIO_WRITE_KEY?: string
}
