import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'

/**
 * Origin of the content catalog API, or undefined while the CMS is off.
 *
 * The catalog is served by the Cloud origin the site already talks to (ingest
 * fronts `/api/v1/catalog/*`), so a deployed preview uses that base URL: the
 * family `PUBLIC_WORKSHOP_CLOUD_ENV` selects (staging, or test with the
 * `workshop-test` label). Nothing is configured in Vercel.
 *
 * `SITE_CATALOG_API_URL` still overrides it, for the local demo
 * (`http://127.0.0.1:8109`) and tests. Local development without it keeps the
 * static Hub. Production stays on the static Hub until the catalog's
 * production gates pass, whatever is set.
 */
export function catalogApiOrigin(): string | undefined {
  if (process.env.VERCEL_ENV === 'production') return undefined
  const override = process.env.SITE_CATALOG_API_URL
  if (override) return override
  return process.env.VERCEL_ENV === 'preview'
    ? WORKSHOP_CLOUD_BASE_URL
    : undefined
}
