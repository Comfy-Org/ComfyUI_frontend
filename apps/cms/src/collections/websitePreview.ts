// Admin preview link for draft-enabled collections: drafts render on the
// always-SSR preview deployment (WEBSITE_PREVIEW_URL) because PREVIEW_MODE is
// set there. Returns null when no preview deployment is configured.
export const websitePreview = (path: string) => (): string | null => {
  const base = process.env.WEBSITE_PREVIEW_URL
  return base ? `${base.replace(/\/$/, '')}${path}` : null
}
