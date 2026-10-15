import { z } from 'astro/zod'
import type { AuthoringSession } from './authoring-session'
import { blankDocument, contentTypes, editorSnapshot } from './editor-document'

export const editorHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  Vary: 'Cookie'
}

export function editorFailure(status: number) {
  return new Response(
    status === 404 ? 'Not found' : 'Catalog editing unavailable',
    { status, headers: editorHeaders }
  )
}

export async function catalogAuthoring(
  session: { credential: string },
  path: string,
  init: RequestInit = {}
) {
  const origin = process.env.SITE_CATALOG_API_URL
  if (!origin || process.env.VERCEL_ENV === 'production')
    return editorFailure(503)
  if (
    !/^\/api\/v1\/catalog\/(?:profiles\?q=[^&?#]+|state|authoring-context|draft\/items(?:\/[0-9a-f-]{36})?|draft\/media(?:\/[0-9a-f-]{36}\/file)?|revisions\/[1-9]\d*\/items\/[0-9a-f-]{36})$/.test(
      path
    )
  )
    return editorFailure(400)
  try {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${session.credential}`)
    const response = await fetch(new URL(path, origin), {
      ...init,
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(init.body instanceof FormData ? 45000 : 15000)
    })
    return response
  } catch {
    return editorFailure(503)
  }
}

export async function loadEditorData(
  session: AuthoringSession | undefined,
  id: string | undefined,
  requestedType: string | null
) {
  if (
    !session?.can_edit ||
    (id !== undefined && !z.uuid().safeParse(id).success)
  )
    return { ok: false as const, response: editorFailure(404) }
  let snapshot
  if (id) {
    const result = await catalogAuthoring(
      session,
      `/api/v1/catalog/draft/items/${id}`
    )
    if (!result.ok)
      return { ok: false as const, response: editorFailure(result.status) }
    const bytes = await boundedBody(result, 1 << 20)
    if (!bytes) return { ok: false as const, response: editorFailure(503) }
    try {
      snapshot = editorSnapshot(JSON.parse(new TextDecoder().decode(bytes)))
    } catch {
      return { ok: false as const, response: editorFailure(503) }
    }
    if (!snapshot) return { ok: false as const, response: editorFailure(404) }
  }
  return {
    ok: true as const,
    snapshot,
    initial: snapshot?.document ?? {
      ...blankDocument(),
      author_uid: session.actor_uid
    },
    type:
      snapshot?.type ??
      contentTypes.find((kind) => kind === requestedType) ??
      'model',
    draft: snapshot?.expected_draft_rev ?? session.state.draft_rev,
    liveRevision: session.state.live_rev,
    csrf: session.csrf
  }
}

export async function boundedBody(
  request: Pick<Request, 'headers' | 'body'>,
  limit: number
) {
  if (Number(request.headers.get('Content-Length')) > limit) return undefined
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) {
        await reader.cancel()
        return undefined
      }
      chunks.push(chunk.value)
    }
  } catch {
    return undefined
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

export async function privateJSON(response: Response) {
  const bytes = await boundedBody(response, 1 << 20)
  if (!bytes) return editorFailure(503)
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return editorFailure(response.ok ? 503 : response.status)
  }
  return Response.json(value, {
    status: response.status,
    headers: editorHeaders
  })
}
