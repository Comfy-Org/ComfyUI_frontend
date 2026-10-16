import 'astro/client'
import type { t } from './i18n/translations'
import type { SiteSession } from './lib/cms/admin'

declare global {
  namespace App {
    interface Locals {
      t: typeof t
      site?: SiteSession
      siteLocalAccess?: boolean
      siteDemo?: boolean
    }
  }

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
    readonly PUBLIC_WORKSHOP_ENABLED?: string
    readonly PUBLIC_WORKSHOP_WORKFLOWS_ENABLED?: string
    readonly PUBLIC_WORKSHOP_APPS_ENABLED?: string
    /** Any build but Vercel production: comma-separated PostHog flags to force on. Production reads them from PostHog only. */
    readonly PUBLIC_WORKSHOP_FLAG_OVERRIDES?: string
    readonly PUBLIC_WORKSHOP_ROUTER_RUN?: string
    readonly PUBLIC_WORKSHOP_SAVE_ASSETS?: string
    /** `astro dev` only: the local CrossView dev proxy, e.g. http://127.0.0.1:4329. */
    readonly PUBLIC_CROSSVIEW_PROXY?: string
    /** Optional Turnstile mode override: off, shadow, or enforce. */
    readonly PUBLIC_WORKSHOP_TURNSTILE_MODE?: string
    readonly PUBLIC_POSTHOG_KEY?: string
    readonly PUBLIC_POSTHOG_API_HOST?: string
    readonly PUBLIC_POSTHOG_UI_HOST?: string
    readonly PUBLIC_CUSTOMERIO_WRITE_KEY?: string
  }
}

// User-Agent Client Hints are Chromium-only, so TypeScript's DOM lib omits them.
declare global {
  interface NavigatorUAData {
    getHighEntropyValues(hints: string[]): Promise<{ architecture?: string }>
  }

  interface Navigator {
    readonly userAgentData?: NavigatorUAData
  }
}
