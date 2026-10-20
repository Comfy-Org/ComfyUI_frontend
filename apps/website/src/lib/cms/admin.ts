import { randomBytes } from 'node:crypto'
import type { APIContext } from 'astro'

export const CONTEXT_COOKIE = 'comfy_site_preview'

export function parsePreview(
  value: string | undefined
): { view: 'DRAFT' | 'LIVE'; now?: string } | undefined {
  if (!value) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('view' in parsed) ||
      (parsed.view !== 'DRAFT' && parsed.view !== 'LIVE')
    )
      return undefined
    const now = 'now' in parsed ? parsed.now : undefined
    if (
      now !== undefined &&
      (typeof now !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
          now
        ) ||
        !Number.isFinite(Date.parse(now)))
    )
      return undefined
    return {
      view: parsed.view,
      ...(typeof now === 'string' ? { now: new Date(now).toISOString() } : {})
    }
  } catch {
    return undefined
  }
}

export function cookieOptions(context: APIContext) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure:
      context.url.protocol === 'https:' ||
      context.request.headers.get('x-forwarded-proto') === 'https',
    path: '/',
    maxAge: 8 * 60 * 60
  }
}

export function newCSRF() {
  return randomBytes(32).toString('hex')
}
