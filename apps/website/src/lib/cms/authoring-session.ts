import { timingSafeEqual } from 'node:crypto'
import type { APIContext } from 'astro'
import type { CccAuthoringContext } from '@comfyorg/ingest-types'
import { zGetCccAuthoringContextResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'astro/zod'
import { boundedBody, catalogAuthoring, editorFailure } from './editor-server'
import type { CatalogPreview } from './catalog-preview'
import { DEMO_COOKIE, resolveDemoSession } from './catalog-demo'
import { accountID } from './account-id'
import {
  hasCatalogCapability,
  narrowToLocalRole
} from '@/lib/cms/catalog-capabilities'

export const AUTHORING_COOKIE = 'comfy_catalog_authoring'
export const AUTHORING_CSRF_COOKIE = 'comfy_catalog_csrf'
export interface AuthoringSession extends CccAuthoringContext {
  credential: string
  csrf: string
  preview?: CatalogPreview
}

// This cookie is a credential transport, never an authorization lease. Verify
// fresh backend grants on each request, and again on every actual mutation.
export async function verifyAuthoringCredential(credential: string) {
  if (!credential || credential.length > 8192 || /[\r\n]/.test(credential))
    return { ok: false as const, response: editorFailure(403) }
  const response = await catalogAuthoring(
    { credential },
    '/api/v1/catalog/authoring-context'
  )
  if (!response.ok)
    return {
      ok: false as const,
      response: editorFailure(
        response.status === 401 || response.status === 403 ? 403 : 503
      )
    }
  const bytes = await boundedBody(response, 64 << 10)
  if (!bytes) return { ok: false as const, response: editorFailure(503) }
  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return { ok: false as const, response: editorFailure(503) }
  }
  const parsed = zGetCccAuthoringContextResponse.safeParse(raw)
  if (
    !parsed.success ||
    !accountID.safeParse(parsed.data.actor_uid).success ||
    !accountID.safeParse(parsed.data.owner_uid).success
  )
    return { ok: false as const, response: editorFailure(503) }
  const state = z
    .object({
      live_rev: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      draft_rev: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      next_rev: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      draft_generation: z
        .number()
        .int()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER),
      previous_live_rev: z
        .number()
        .int()
        .positive()
        .max(Number.MAX_SAFE_INTEGER)
        .nullable()
    })
    .safeParse(
      Object.fromEntries(
        Object.entries(parsed.data.state).map(([key, value]) => [
          key,
          value === null ? null : Number(value)
        ])
      )
    )
  if (!state.success)
    return { ok: false as const, response: editorFailure(503) }
  if (!hasCatalogCapability(parsed.data))
    return { ok: false as const, response: editorFailure(403) }
  return { ok: true as const, context: { ...parsed.data, state: state.data } }
}

export async function loadAuthoringSession(context: APIContext) {
  const demoToken = context.cookies.get(DEMO_COOKIE)?.value
  const demo = demoToken
    ? await resolveDemoSession(demoToken).catch(() => undefined)
    : undefined
  if (demoToken && !demo)
    return { ok: false as const, response: editorFailure(403) }
  const credential =
    demo?.credential ?? context.cookies.get(AUTHORING_COOKIE)?.value
  const csrf = context.cookies.get(AUTHORING_CSRF_COOKIE)?.value
  if (!credential || !csrf || !/^[a-f0-9]{64}$/.test(csrf))
    return { ok: false as const, response: editorFailure(404) }
  const verified = await verifyAuthoringCredential(credential)
  if (!verified.ok) return verified
  return {
    ok: true as const,
    session: {
      ...(demo
        ? narrowToLocalRole(verified.context, demo.role)
        : verified.context),
      credential,
      csrf
    }
  }
}

export function validAuthoringOrigin(context: APIContext) {
  const origin = context.request.headers.get('Origin')
  return Boolean(
    origin &&
    [
      context.url.origin,
      ...(process.env.SITE_CATALOG_WEBSITE_ORIGINS ?? '')
        .split(',')
        .filter(Boolean)
    ].includes(origin)
  )
}

export function validAuthoringMutation(context: APIContext) {
  const token = context.request.headers.get('X-Comfy-CSRF')
  const expected = context.cookies.get(AUTHORING_CSRF_COOKIE)?.value
  return Boolean(
    validAuthoringOrigin(context) &&
    token &&
    expected &&
    /^[a-f0-9]{64}$/.test(token) &&
    /^[a-f0-9]{64}$/.test(expected) &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
}

export function isAuthoringRoute(path: string) {
  return (
    path.replace(/\/$/, '') === '/admin/catalog-preview' ||
    /^\/admin\/content\/(?:new|[0-9a-f-]{36}\/(?:edit|view))\/?$/.test(path) ||
    /^\/admin\/content-api\/(?:state|item|save|upload|profiles|delete)\/?$/.test(
      path
    ) ||
    /^\/admin\/catalog(?:\/final-review)?\/?$/.test(path) ||
    /^\/admin\/catalog-api\/(?:staging|final-review|exit|discard-changes|publish)\/?$/.test(
      path
    )
  )
}
