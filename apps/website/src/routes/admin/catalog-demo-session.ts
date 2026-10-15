import { timingSafeEqual } from 'node:crypto'
import type { APIRoute } from 'astro'
import { cookieOptions, newCSRF } from '@/lib/cms/admin'
import {
  AUTHORING_COOKIE,
  AUTHORING_CSRF_COOKIE,
  validAuthoringOrigin,
  verifyAuthoringCredential
} from '@/lib/cms/authoring-session'
import {
  DEMO_COOKIE,
  DEMO_LOGIN_CSRF,
  demoEnabled,
  demoParent,
  redeemDemoInvitation
} from '@/lib/cms/catalog-demo'
import {
  boundedBody,
  editorFailure,
  editorHeaders
} from '@/lib/cms/editor-server'

const attempts = new Map<string, { started: number; count: number }>()
export const POST: APIRoute = async (context) => {
  if (!demoEnabled()) return editorFailure(404)
  if (
    context.url.search ||
    !validAuthoringOrigin(context) ||
    !context.request.headers
      .get('Content-Type')
      ?.startsWith('application/x-www-form-urlencoded')
  )
    return editorFailure(403)
  const key = context.clientAddress
  const existing = attempts.get(key)
  const attempt =
    existing && Date.now() - existing.started < 60000
      ? existing
      : { started: Date.now(), count: 0 }
  if (attempts.size > 1000) attempts.clear()
  attempts.set(key, attempt)
  if (++attempt.count > 30) return editorFailure(429)
  const bytes = await boundedBody(context.request, 4096)
  if (!bytes) return editorFailure(400)
  const form = new URLSearchParams(new TextDecoder().decode(bytes))
  const csrf = form.get('csrf') ?? ''
  const expected = context.cookies.get(DEMO_LOGIN_CSRF)?.value ?? ''
  if (
    !/^[a-f0-9]{64}$/.test(csrf) ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    !timingSafeEqual(Buffer.from(csrf), Buffer.from(expected))
  )
    return editorFailure(403)
  try {
    const parent = await demoParent()
    const verified = await verifyAuthoringCredential(parent.credential)
    if (!verified.ok) return verified.response
    // The demo parent must hold both capabilities in its own right.
    if (!verified.context.can_edit) return editorFailure(403)
    if (!verified.context.can_apply) return editorFailure(403)
    if (
      verified.context.actor_uid !== '00000000-0000-4000-8000-000000000003' ||
      verified.context.owner_uid !== '00000000-0000-4000-8000-000000000001'
    )
      return editorFailure(403)
    const invitation = await redeemDemoInvitation(form.get('code') ?? '')
    if (!invitation) return editorFailure(403)
    const options = {
      ...cookieOptions(context),
      maxAge: Math.max(1, Math.floor((invitation.expires - Date.now()) / 1000))
    }
    context.cookies.delete(AUTHORING_COOKIE, { path: '/' })
    context.cookies.delete(DEMO_LOGIN_CSRF, { path: '/' })
    context.cookies.set(DEMO_COOKIE, invitation.token, options)
    context.cookies.set(AUTHORING_CSRF_COOKIE, newCSRF(), options)
    const response = context.redirect('/admin/catalog', 303)
    for (const [name, value] of Object.entries(editorHeaders))
      response.headers.set(name, value)
    return response
  } catch {
    return editorFailure(503)
  }
}
