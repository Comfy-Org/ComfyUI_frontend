const DEFAULT_ORIGIN = 'https://www.comfy.org'

function normalizeOrigin(raw?: string): string {
  const v = raw?.trim()
  if (!v) return DEFAULT_ORIGIN
  try {
    return new URL(v).origin
  } catch {
    return DEFAULT_ORIGIN
  }
}

export const SITE_ORIGIN = normalizeOrigin(import.meta.env.PUBLIC_SITE_ORIGIN)

export function absoluteUrl(pathname: string): string {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${SITE_ORIGIN}${p}`
}
