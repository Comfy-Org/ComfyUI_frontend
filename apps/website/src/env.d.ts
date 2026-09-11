/// <reference path="../.astro/types.d.ts" />

// Opting into Vite's strict mode drops the `[key: string]: any` fallback on
// ImportMetaEnv, so an undeclared `import.meta.env.X` is a compile error
// instead of a silent `any`.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  /**
   * Which Cloud family Workshop talks to: 'prod', 'staging' or 'test'. Unset
   * means staging for local builds. Deployed builds that include Workshop must
   * set an allowed family. See config/workshop-env.ts and workshop-release.ts.
   */
  readonly PUBLIC_WORKSHOP_CLOUD_ENV?: string
  /** '1' forces the Workshop auth flag on — PostHog only runs in PROD builds. */
  readonly PUBLIC_WORKSHOP_AUTH_FLAG?: string
  readonly PUBLIC_WORKSHOP_ROUTER_RUN?: string
  /** Optional Turnstile mode override: off, shadow, or enforce. */
  readonly PUBLIC_WORKSHOP_TURNSTILE_MODE?: string
  readonly PUBLIC_POSTHOG_KEY?: string
  readonly PUBLIC_POSTHOG_API_HOST?: string
  readonly PUBLIC_POSTHOG_UI_HOST?: string
  readonly PUBLIC_CUSTOMERIO_WRITE_KEY?: string
}
