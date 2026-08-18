/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Overrides the committed public CMS default (`DEFAULT_CMS_URL`). Build-time only. */
  readonly WEBSITE_CMS_URL?: string
  /** `'true'` on the always-SSR preview deployment; enables SSR + draft fetch + noindex. */
  readonly PREVIEW_MODE?: string
  /** Payload API key for authenticated draft reads. Preview deployment only; server-side. */
  readonly PAYLOAD_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
