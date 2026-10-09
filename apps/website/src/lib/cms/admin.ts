import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { APIContext } from 'astro'
import { zContentCatalogReview } from '@comfyorg/ingest-types/zod'
import type { ContentCatalogReview } from '@comfyorg/ingest-types'
import { normalizeProjection } from './catalog-contract'
import { catalogFetch } from './demo'

export interface SiteSession {
  credential: string
  review: ContentCatalogReview
  csrf: string
  preview?: { view: 'DRAFT' | 'LIVE'; now?: string }
}

export const SESSION_COOKIE = 'comfy_site_session'
export const CONTEXT_COOKIE = 'comfy_site_preview'
export const CSRF_COOKIE = 'comfy_site_csrf'

export async function siteAPI(
  path: string,
  credential: string,
  init: RequestInit = {}
) {
  const origin = process.env.SITE_CATALOG_API_URL
  if (!origin || process.env.VERCEL_ENV === 'production')
    return new Response(null, { status: 503 })
  if (!path.startsWith('/admin/api/site/'))
    throw new Error('Invalid site API path')
  try {
    return await catalogFetch(new URL(path, origin), {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credential}`
      }
    })
  } catch {
    return new Response(null, { status: 503 })
  }
}

export async function verifySiteSession(
  credential: string
): Promise<ContentCatalogReview | undefined> {
  if (!credential || credential.length > 8192 || /[\r\n]/.test(credential))
    return undefined
  const response = await siteAPI('/admin/api/site/review', credential)
  if (!response.ok) return undefined
  let data: unknown
  try {
    data = await response.json()
  } catch {
    return undefined
  }
  const review = zContentCatalogReview.safeParse(data)
  if (!review.success || (!review.data.can_edit && !review.data.can_apply))
    return undefined
  const draft = normalizeProjection(review.data.draft)
  const live = normalizeProjection(review.data.live)
  const previousLive =
    review.data.previous_live_id === undefined
      ? undefined
      : Number(review.data.previous_live_id)
  if (
    !draft ||
    !live ||
    draft.revision_id !== live.revision_id + 1 ||
    (previousLive !== undefined && !Number.isSafeInteger(previousLive))
  )
    return undefined
  return {
    ...review.data,
    previous_live_id: previousLive,
    draft,
    live
  }
}

export function parsePreview(
  value: string | undefined
): SiteSession['preview'] {
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
    maxAge:
      import.meta.env.DEV &&
      !process.env.VERCEL_ENV &&
      process.env.SITE_CATALOG_LOCAL_CREDENTIAL_FILE
        ? 7 * 24 * 60 * 60
        : 8 * 60 * 60
  }
}

export function newCSRF() {
  return randomBytes(32).toString('hex')
}

export function validMutation(context: APIContext, token: unknown) {
  const origin = context.request.headers.get('origin')
  const allowed = [
    context.url.origin,
    ...(process.env.SITE_CATALOG_WEBSITE_ORIGINS ?? '')
      .split(',')
      .filter(Boolean)
  ]
  const expected = context.cookies.get(CSRF_COOKIE)?.value
  return Boolean(
    origin &&
    allowed.includes(origin) &&
    expected &&
    /^[a-f0-9]{64}$/.test(expected) &&
    typeof token === 'string' &&
    /^[a-f0-9]{64}$/.test(token) &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
}

export function draftChanges(review: ContentCatalogReview) {
  const live = new Map(review.live.items.map((item) => [item.uid, item]))
  const draft = new Map(review.draft.items.map((item) => [item.uid, item]))
  return [...new Set([...live.keys(), ...draft.keys()])].flatMap((uid) => {
    const before = live.get(uid)
    const after = draft.get(uid)
    if (before?.edit_version === after?.edit_version) return []
    return [{ uid, before, after }]
  })
}
