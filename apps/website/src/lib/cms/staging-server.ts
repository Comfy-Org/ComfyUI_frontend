import type { AuthoringSession } from './authoring-session'
import { boundedBody, editorFailure } from './editor-server'
import type { ReviewFilter } from './staging-review'
import { filterQuery, stagingSnapshot, finalSnapshot } from './staging-review'

export async function catalogReview(
  session: AuthoringSession,
  operation:
    | 'staging'
    | 'final-review'
    | 'review-receipt'
    | 'discard-changes'
    | 'publish',
  filter: ReviewFilter = {},
  init: RequestInit = {}
) {
  const origin = process.env.SITE_CATALOG_API_URL
  if (!origin || process.env.VERCEL_ENV === 'production')
    return editorFailure(503)
  const query = operation === 'staging' ? filterQuery(filter).toString() : ''
  const path =
    operation === 'review-receipt' ? 'final-review/receipt' : operation
  const url = new URL(`/api/v1/catalog/draft/${path}`, origin)
  url.search = query
  try {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${session.credential}`)
    return await fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(
        operation === 'publish' && isLocalDemo() ? 60000 : 15000
      )
    })
  } catch {
    return editorFailure(503)
  }
}
export async function readReviewResponse(response: Response, final = false) {
  if (!response.ok) return { ok: false as const, status: response.status }
  // Temporary demo compatibility, not an ordinary/production response budget.
  const bytes = await boundedBody(response, isLocalDemo() ? 16 << 20 : 8 << 20)
  if (!bytes) return { ok: false as const, status: 503 }
  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return { ok: false as const, status: 503 }
  }
  const snapshot = final ? finalSnapshot(raw) : stagingSnapshot(raw)
  if (!snapshot) return { ok: false as const, status: 503 }
  return { ok: true as const, snapshot }
}

function isLocalDemo() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.VERCEL_ENV !== 'production' &&
    Boolean(process.env.SITE_CATALOG_DEMO_INVITATIONS_FILE) &&
    /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(
      process.env.SITE_CATALOG_API_URL ?? ''
    )
  )
}
