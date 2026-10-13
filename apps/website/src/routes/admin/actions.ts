import type { APIRoute, APIContext } from 'astro'
import {
  CONTEXT_COOKIE,
  cookieOptions,
  parsePreview,
  siteAPI,
  validMutation
} from '@/lib/cms/admin'
import { saveDraftItem, undoDraftItem } from '@/lib/cms/save-item'
import { saveStaging } from '@/lib/cms/staging'
import { restoreVersion } from '@/lib/cms/versions'

function returnPath(value: FormDataEntryValue | null) {
  return typeof value === 'string' && /^\/(?![/\\])[^\s]*$/.test(value)
    ? value
    : '/hub/models/'
}

function previewAction(context: APIContext, body: FormData) {
  const action = body.get('action')
  if (action === 'exit') context.cookies.delete(CONTEXT_COOKIE, { path: '/' })
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

const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function publishCommand(body: FormData) {
  const approvals = submissionReviews(body, 'approve', 'approved')
  const approvedItems = body.getAll('approve_item').map(String)
  if (!approvals || !approvedItems.every((uid) => UID.test(uid)))
    return new Response('Invalid submission', { status: 400 })
  return {
    commands: [
      ...approvals,
      {
        path: '/admin/api/site/publish',
        payload: {
          draft_id: Number(body.get('draft_id')),
          generation: Number(body.get('generation')),
          // Only these catalog changes go live; deferred ones stay in the draft.
          approved_uids: approvedItems
        }
      }
    ],
    destination: '/admin/history/'
  }
}

function revertCommand(body: FormData) {
  const target = body.get('target_id')
  if (target !== null && !/^\d+$/.test(String(target)))
    return new Response('Invalid revision', { status: 400 })
  return {
    commands: [
      {
        path: '/admin/api/site/revert',
        payload: {
          live_id: Number(body.get('live_id')),
          // Restoring an older revision than the previous publish needs
          // the ingest revert endpoint to accept a target.
          ...(target === null ? {} : { target_id: Number(target) })
        }
      }
    ],
    destination: '/admin/history/'
  }
}

function rejectCommand(body: FormData) {
  const rejections = submissionReviews(body, 'submission', 'rejected')
  if (!rejections?.length)
    return new Response('Invalid submission', { status: 400 })
  return { commands: rejections, destination: '/admin/' }
}

const commands = new Map<
  string,
  (body: FormData) => ReturnType<typeof publishCommand>
>([
  ['publish', publishCommand],
  ['revert', revertCommand],
  ['reject', rejectCommand]
])

function publication(body: FormData) {
  const command = commands.get(String(body.get('action')))
  return command
    ? command(body)
    : new Response('Unknown action', { status: 400 })
}

type SiteSession = NonNullable<APIContext['locals']['site']>

// Draft edits answer the page's fetch with JSON instead of redirecting.
const edits = new Map<
  string,
  (session: SiteSession, body: FormData) => Promise<unknown>
>([
  ['save', (s, body) => saveDraftItem(s, body.get('uid'), body.get('record'))],
  ['stage', (s, body) => saveStaging(s, body.get('decision'))],
  [
    'restoreVersion',
    (s, body) => restoreVersion(s, body.get('uid'), body.get('version'))
  ],
  ['undo', (s, body) => undoDraftItem(s, body.get('uid'))]
])

async function runCommands(
  commands: SiteCommand[],
  credential: string
): Promise<Response | undefined> {
  for (const { path, payload } of commands) {
    const response = await siteAPI(path, credential, {
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
  return undefined
}

export const POST: APIRoute = async (context) => {
  const session = context.locals.site
  if (!session) return new Response('Not found', { status: 404 })
  const body = await context.request.formData()
  if (!validMutation(context, body.get('csrf')))
    return new Response('Access denied', { status: 403 })
  if (['exit', 'preview', 'now'].includes(String(body.get('action'))))
    return previewAction(context, body)
  const edit = edits.get(String(body.get('action')))
  if (edit)
    return Response.json(await edit(session, body), {
      headers: { 'Cache-Control': 'private, no-store' }
    })
  if (!session.review.can_apply)
    return new Response('Access denied', { status: 403 })
  if (body.get('confirm') !== 'yes')
    return new Response('Confirmation required', { status: 400 })
  const command = publication(body)
  if (command instanceof Response) return command
  const failure = await runCommands(command.commands, session.credential)
  if (failure) return failure
  return context.redirect(command.destination, 303)
}
