// Server-only configuration. Browser islands read same-origin JSON endpoints.
// Production keeps the static Hub even if the variable is set there.
export const cmsEnabled = () =>
  Boolean(process.env.SITE_CATALOG_API_URL) &&
  process.env.VERCEL_ENV !== 'production'
