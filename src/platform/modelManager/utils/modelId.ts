import { DEFAULT_ALLOWED_HOSTS, MODEL_EXTENSIONS } from '../types'

const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function isValidPathSegment(segment: string): boolean {
  return SEGMENT_PATTERN.test(segment)
}

export function hasModelExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return MODEL_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function buildModelId(directory: string, filename: string): string {
  return `${directory.replace(/\/+$/, '')}/${filename.replace(/^\/+/, '')}`
}

/**
 * Lowercased host of a URL, or `null` when the URL is unparseable.
 */
export function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/

function isIpLiteral(host: string): boolean {
  return IPV4_PATTERN.test(host) || host.includes(':')
}

/**
 * Optimistic client-side allowlist hint (§9.1). The server can extend the
 * allowlist, so a `false` here is advisory — defer to `URL_NOT_ALLOWED`.
 */
export function isLikelyAllowedHost(url: string): boolean {
  const host = hostFromUrl(url)
  if (!host) return false
  return DEFAULT_ALLOWED_HOSTS.some(
    (allowed) =>
      host === allowed ||
      (!isIpLiteral(allowed) && host.endsWith(`.${allowed}`))
  )
}

/**
 * Best-effort filename guess from a URL path, for prefilling the model_id
 * filename field. May be empty when the URL has no usable trailing segment.
 */
export function filenameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url)
    const last = pathname.split('/').filter(Boolean).pop() ?? ''
    return decodeURIComponent(last)
  } catch {
    return ''
  }
}
