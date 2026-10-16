import type { APIRoute } from 'astro'
import { validAuthoringMutation } from '@/lib/cms/authoring-session'
import { CONTEXT_COOKIE } from '@/lib/cms/admin'
import {
  boundedBody,
  editorFailure,
  editorHeaders
} from '@/lib/cms/editor-server'
import {
  filterFromQuery,
  stageBody,
  discardBody,
  publishBody,
  checkedReviewBody,
  checkedPublishBody,
  publicationState
} from '@/lib/cms/staging-review'
import { z } from 'astro/zod'
import { catalogReview, readReviewResponse } from '@/lib/cms/staging-server'
import { hasCatalogCapability } from '@/lib/cms/catalog-capabilities'
import { reviewErrors } from '@/lib/cms/review-errors'
import { reviewReceipt } from '@/lib/cms/review-receipt'

type Operation =
  | 'staging'
  | 'exit'
  | 'discard-changes'
  | 'publish'
  | 'final-review'
  | 'review-receipt'

// Each operation needs one backend capability, read as received and
// mirroring the backend's own check on the forwarded request. `exit` only
// clears this site's Preview cookie.
function requiredCapability(
  session: { can_edit: boolean; can_apply: boolean },
  operation: Operation
): boolean {
  switch (operation) {
    case 'staging':
    case 'publish':
    case 'final-review':
    case 'review-receipt':
      return session.can_apply
    case 'discard-changes':
      return session.can_edit
    case 'exit':
      return true
  }
}

export const GET: APIRoute = async (context) => {
  const session = context.locals.catalogAuthoring
  const operation = context.params.operation
  if (!session || !hasCatalogCapability(session)) return editorFailure(404)
  if (operation !== 'staging' && operation !== 'final-review')
    return editorFailure(404)
  if (operation === 'final-review' && !requiredCapability(session, operation))
    return editorFailure(404)
  const filter = filterFromQuery(context.url.searchParams)
  if (!filter || (operation === 'final-review' && context.url.search))
    return editorFailure(400)
  const result = await readReviewResponse(
    await catalogReview(session, operation, filter),
    operation === 'final-review'
  )
  return result.ok
    ? Response.json(result.snapshot, { headers: editorHeaders })
    : editorFailure(result.status)
}
export const POST: APIRoute = async (context) => {
  const session = context.locals.catalogAuthoring
  const operation = context.params.operation
  if (!session || !hasCatalogCapability(session)) return editorFailure(404)
  if (
    operation !== 'staging' &&
    operation !== 'exit' &&
    operation !== 'discard-changes' &&
    operation !== 'publish' &&
    operation !== 'final-review' &&
    operation !== 'review-receipt'
  )
    return editorFailure(404)
  if (!requiredCapability(session, operation)) return editorFailure(404)
  if (context.url.search) return editorFailure(400)
  if (!validAuthoringMutation(context)) return editorFailure(403)
  if (operation === 'exit') {
    context.cookies.delete(CONTEXT_COOKIE, { path: '/' })
    return new Response(null, { status: 204, headers: editorHeaders })
  }
  const key = context.request.headers.get('Idempotency-Key')
  if (
    operation !== 'final-review' &&
    operation !== 'review-receipt' &&
    (!key || key.length > 200 || /[\r\n]/.test(key))
  )
    return editorFailure(400)
  if (
    !context.request.headers.get('Content-Type')?.startsWith('application/json')
  )
    return editorFailure(415)
  const bytes = await boundedBody(context.request, 256 << 10)
  if (!bytes) return editorFailure(413)
  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return editorFailure(400)
  }
  const parsed = (
    operation === 'final-review' || operation === 'review-receipt'
      ? checkedReviewBody
      : operation === 'publish'
        ? z.union([checkedPublishBody, publishBody])
        : operation === 'discard-changes'
          ? discardBody
          : stageBody
  ).safeParse(raw)
  if (!parsed.success) return editorFailure(400)
  const upstream = await catalogReview(
    session,
    operation,
    {},
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'Idempotency-Key': key } : {})
      },
      body: JSON.stringify(parsed.data)
    }
  )
  if (
    upstream.status === 422 &&
    (operation === 'final-review' ||
      operation === 'review-receipt' ||
      operation === 'publish' ||
      operation === 'discard-changes')
  ) {
    const bytes = await boundedBody(upstream, 64 << 10)
    if (!bytes) return editorFailure(503)
    try {
      const result = reviewErrors.safeParse(
        JSON.parse(new TextDecoder().decode(bytes))
      )
      if (result.success)
        return Response.json(result.data, {
          status: 422,
          headers: editorHeaders
        })
    } catch {
      /* Malformed authority responses fail closed. */
    }
    return editorFailure(422)
  }
  if (operation === 'review-receipt') {
    if (upstream.status !== 200)
      return editorFailure(upstream.ok ? 503 : upstream.status)
    const bytes = await boundedBody(upstream, 16 << 10)
    if (!bytes) return editorFailure(503)
    try {
      const receipt = reviewReceipt(JSON.parse(new TextDecoder().decode(bytes)))
      return receipt
        ? Response.json(receipt, { headers: editorHeaders })
        : editorFailure(503)
    } catch {
      return editorFailure(503)
    }
  }
  if (operation === 'final-review') {
    const result = await readReviewResponse(upstream, true)
    return result.ok
      ? Response.json(result.snapshot, { headers: editorHeaders })
      : editorFailure(result.status)
  }
  if (operation === 'publish') {
    if (!upstream.ok) return editorFailure(upstream.status)
    const bytes = await boundedBody(upstream, 64 << 10)
    if (!bytes) return editorFailure(503)
    try {
      const state = publicationState(
        JSON.parse(new TextDecoder().decode(bytes))
      )
      return state
        ? Response.json(state, { headers: editorHeaders })
        : editorFailure(503)
    } catch {
      return editorFailure(503)
    }
  }
  const result = await readReviewResponse(upstream)
  return result.ok
    ? Response.json(result.snapshot, { headers: editorHeaders })
    : editorFailure(result.status)
}
