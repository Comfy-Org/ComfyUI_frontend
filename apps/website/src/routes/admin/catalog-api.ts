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
  publicationState
} from '@/lib/cms/staging-review'
import { z } from 'astro/zod'
import { catalogReview, readReviewResponse } from '@/lib/cms/staging-server'

export const GET: APIRoute = async (context) => {
  const session = context.locals.catalogAuthoring
  const operation = context.params.operation
  if (!session || (!session.can_edit && !session.can_apply))
    return editorFailure(404)
  if (operation !== 'staging' && operation !== 'final-review')
    return editorFailure(404)
  if (operation === 'final-review' && !session.can_apply)
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
  if (!session || (!session.can_edit && !session.can_apply))
    return editorFailure(404)
  if (
    operation !== 'staging' &&
    operation !== 'exit' &&
    operation !== 'discard-changes' &&
    operation !== 'publish'
  )
    return editorFailure(404)
  if (operation === 'staging' && !session.can_apply) return editorFailure(404)
  if (operation === 'publish' && !session.can_apply) return editorFailure(404)
  if (operation === 'discard-changes' && !session.can_edit)
    return editorFailure(404)
  if (context.url.search) return editorFailure(400)
  if (!validAuthoringMutation(context)) return editorFailure(403)
  if (operation === 'exit') {
    context.cookies.delete(CONTEXT_COOKIE, { path: '/' })
    return new Response(null, { status: 204, headers: editorHeaders })
  }
  const key = context.request.headers.get('Idempotency-Key')
  if (!key || key.length > 200 || /[\r\n]/.test(key)) return editorFailure(400)
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
    operation === 'publish'
      ? publishBody
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
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(parsed.data)
    }
  )
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
  if (operation === 'discard-changes' && upstream.status === 422) {
    const bytes = await boundedBody(upstream, 64 << 10)
    if (!bytes) return editorFailure(503)
    try {
      const result = z
        .object({
          field_errors: z
            .array(
              z.object({
                path: z.string().max(2000),
                message: z.string().max(1000)
              })
            )
            .max(100)
        })
        .safeParse(JSON.parse(new TextDecoder().decode(bytes)))
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
  const result = await readReviewResponse(upstream)
  return result.ok
    ? Response.json(result.snapshot, { headers: editorHeaders })
    : editorFailure(result.status)
}
