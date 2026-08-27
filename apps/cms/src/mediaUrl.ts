// Single source for where uploaded media lives on the CDN. payload.config.ts
// builds the stored file urls from these values, and next.config.ts derives the
// next/image remote pattern from the same ones — so a custom host, base path, or
// prefix stays allowed by the image optimizer instead of drifting from the urls
// the CMS actually writes.
export const gcsMediaPrefix = (process.env.GCS_MEDIA_PREFIX || 'website/cms').replace(
  /^\/+|\/+$/g,
  '',
)

export const gcsPublicBase = (process.env.GCS_PUBLIC_BASE_URL || 'https://media.comfy.org').replace(
  /\/+$/,
  '',
)
