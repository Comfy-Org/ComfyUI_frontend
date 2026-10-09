import type { APIRoute, APIContext } from 'astro'
import {
  CONTEXT_COOKIE,
  cookieOptions,
  parsePreview,
  siteAPI,
  validMutation
} from '@/lib/cms/admin'

function returnPath(value: FormDataEntryValue | null) {
  return typeof value === 'string' && /^\/(?![/\\])[^\s]*$/.test(value)
    ? value
    : '/hub/models/'
}

function previewAction(context: APIContext, body: FormData) {
  const action = body.get('action')
  if (action === 'exit' || body.get('view') === 'LIVE')
    context.cookies.delete(CONTEXT_COOKIE, { path: '/' })
  else {
    const preview = parsePreview(
      JSON.stringify({
        view: body.get('view') ?? context.locals.site?.preview?.view ?? 'DRAFT',
        ...(action !== 'now' && body.get('now') ? { now: body.get('now') } : {})
      })
    )
    if (!preview)
      return new Response('Invalid preview selection', { status: 400 })
    context.cookies.set(
      CONTEXT_COOKIE,
      JSON.stringify(preview),
      cookieOptions(context)
    )
  }
  return context.redirect(returnPath(body.get('return_to')), 303)
}

interface SiteCommand {
  path: string
  payload: Record<string, unknown>
}

function submissionReviews(body: FormData, field: string, status: string) {
  const entries = body.getAll(field).map(String)
  if (!entries.every((entry) => /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_.-]+$/.test(entry)))
    return undefined
  return entries.map((entry): SiteCommand => {
    const [shareID, versionID] = entry.split(':')
    return {
      path: `/admin/api/site/submissions/${shareID}/review`,
      payload: { version_id: versionID, status }
    }
  })
}

function publication(body: FormData) {
  const action = body.get('action')
  if (action === 'publish') {
    const approvals = submissionReviews(body, 'approve', 'approved')
    if (!approvals) return new Response('Invalid submission', { status: 400 })
    return {
      commands: [
        ...approvals,
        {
          path: '/admin/api/site/publish',
          payload: {
            draft_id: Number(body.get('draft_id')),
            generation: Number(body.get('generation'))
          }
        }
      ],
      destination: '/admin/history/'
    }
  } else if (action === 'revert') {
    return {
      commands: [
        {
          path: '/admin/api/site/revert',
          payload: { live_id: Number(body.get('live_id')) }
        }
      ],
      destination: '/admin/history/'
    }
  } else if (action === 'reject') {
    const rejections = submissionReviews(body, 'submission', 'rejected')
    if (!rejections?.length)
      return new Response('Invalid submission', { status: 400 })
    return { commands: rejections, destination: '/admin/' }
  } else return new Response('Unknown action', { status: 400 })
}

export const POST: APIRoute = async (context) => {
  const session = context.locals.site
  if (!session) return new Response('Not found', { status: 404 })
  const body = await context.request.formData()
  if (!validMutation(context, body.get('csrf')))
    return new Response('Access denied', { status: 403 })
  if (['exit', 'preview', 'now'].includes(String(body.get('action'))))
    return previewAction(context, body)
  if (!session.review.can_apply)
    return new Response('Access denied', { status: 403 })
  if (body.get('confirm') !== 'yes')
    return new Response('Confirmation required', { status: 400 })
  const command = publication(body)
  if (command instanceof Response) return command
  for (const { path, payload } of command.commands) {
    const response = await siteAPI(path, session.credential, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (!response.ok)
      return new Response(
        response.status === 409
          ? 'Content changed. Reload and review before trying again.'
          : 'Action failed.',
        {
          status: response.status,
          headers: { 'Cache-Control': 'private, no-store' }
        }
      )
  }
  return context.redirect(command.destination, 303)
}
