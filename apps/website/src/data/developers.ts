/**
 * Structured, non-copy data for the /developers page. Display copy lives in
 * the `developers.*` namespace of src/i18n/translations.ts.
 */

/**
 * CTA destinations. `joinBeta` is a placeholder until the real Serverless API
 * beta signup target exists (tracked in the developers-page content pass).
 */
export const developersCtas = {
  platform: 'https://cloud.comfy.org',
  docs: 'https://docs.comfy.org',
  sdkDocs: 'https://docs.comfy.org',
  joinBeta: 'https://cloud.comfy.org'
} as const
