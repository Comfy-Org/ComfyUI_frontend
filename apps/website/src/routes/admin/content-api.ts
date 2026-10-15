import type { APIRoute } from 'astro'
import { z } from 'astro/zod'

import { validAuthoringMutation } from '@/lib/cms/authoring-session'
import { profileChoices, validProfileQuery } from '@/lib/cms/profile-client'
import { jsonObject } from '@/lib/cms/editor-document'
import {
  boundedBody,
  catalogAuthoring,
  editorFailure,
  privateJSON
} from '@/lib/cms/editor-server'

const uid = z.uuid()
const allowed = new Set(['state', 'item', 'save', 'upload', 'delete'])

export const GET: APIRoute = async (context) => {
  const session = context.locals.catalogAuthoring
  if (!session?.can_edit) return editorFailure(404)
  const operation = context.params.operation
  if (operation === 'profiles') {
    const query = context.url.searchParams
    const q = query.get('q') ?? ''
    if (
      query.size !== 1 ||
      query.getAll('q').length !== 1 ||
      !validProfileQuery(q)
    )
      return editorFailure(400)
    const response = await catalogAuthoring(
      session,
      `/api/v1/catalog/profiles?${new URLSearchParams({ q })}`
    )
    if (!response.ok) return editorFailure(response.status)
    const bytes = await boundedBody(response, 1 << 20)
    if (!bytes) return editorFailure(503)
    try {
      const parsed = profileChoices.safeParse(
        JSON.parse(new TextDecoder().decode(bytes))
      )
      return parsed.success
        ? privateJSON(Response.json(parsed.data))
        : editorFailure(503)
    } catch {
      return editorFailure(503)
    }
  }
  if (operation !== 'state' && operation !== 'item') return editorFailure(404)
  const params = context.url.searchParams
  if (
    [...params.keys()].some((key) => key !== 'uid') ||
    params.getAll('uid').length > 1
  )
    return editorFailure(400)
  const id = uid.safeParse(params.get('uid'))
  if (
    (operation === 'item' && !id.success) ||
    (operation === 'state' && params.size !== 0)
  )
    return editorFailure(400)
  return privateJSON(
    await catalogAuthoring(
      session,
      operation === 'state'
        ? '/api/v1/catalog/state'
        : `/api/v1/catalog/draft/items/${id.success ? id.data : ''}`
    )
  )
}

export const POST: APIRoute = async (context) => {
  const session = context.locals.catalogAuthoring
  if (!session?.can_edit) return editorFailure(404)
  const operation = context.params.operation
  if (
    !operation ||
    !allowed.has(operation) ||
    !['save', 'upload', 'delete'].includes(operation)
  )
    return editorFailure(404)
  if (context.url.search) return editorFailure(400)
  if (!validAuthoringMutation(context)) return editorFailure(403)
  const key = context.request.headers.get('Idempotency-Key')
  if (!key || key.length > 200 || /[\r\n]/.test(key)) return editorFailure(400)
  const bytes = await boundedBody(
    context.request,
    operation === 'upload' ? 65 << 20 : 1 << 20
  )
  if (!bytes) return editorFailure(413)
  if (operation === 'save' || operation === 'delete') {
    if (
      !context.request.headers
        .get('Content-Type')
        ?.startsWith('application/json')
    )
      return editorFailure(415)
    let raw: unknown
    try {
      raw = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      return editorFailure(400)
    }
    const parsed = jsonObject.safeParse(raw)
    if (!parsed.success) return editorFailure(400)
    const { uid: rawUID, ...body } = parsed.data
    const id = Object.hasOwn(parsed.data, 'uid') ? rawUID : undefined
    if (id !== undefined && !uid.safeParse(id).success)
      return editorFailure(400)
    if (operation === 'delete') {
      const token = z
        .object({
          expected_draft_rev: z
            .number()
            .int()
            .positive()
            .max(Number.MAX_SAFE_INTEGER),
          expected_revision_uid: z.uuid()
        })
        .strict()
        .safeParse(body)
      if (typeof id !== 'string' || !token.success) return editorFailure(400)
      return privateJSON(
        await catalogAuthoring(session, `/api/v1/catalog/draft/items/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': key
          },
          body: JSON.stringify(token.data)
        })
      )
    }
    const response = await catalogAuthoring(
      session,
      typeof id === 'string'
        ? `/api/v1/catalog/draft/items/${id}`
        : '/api/v1/catalog/draft/items',
      {
        method: id === undefined ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(body)
      }
    )
    return privateJSON(response)
  }
  if (
    !context.request.headers
      .get('Content-Type')
      ?.startsWith('multipart/form-data;')
  )
    return editorFailure(415)
  let form: FormData
  try {
    form = await new Response(bytes, {
      headers: {
        'Content-Type': context.request.headers.get('Content-Type') ?? ''
      }
    }).formData()
  } catch {
    return editorFailure(400)
  }
  const names = [...form.keys()]
  if (
    new Set(names).size !== names.length ||
    names.some(
      (name) =>
        ![
          'file',
          'name',
          'expected_draft_rev',
          'originating_entity_uid',
          'role',
          'media_uid',
          'expected_revision_uid'
        ].includes(name)
    )
  )
    return editorFailure(400)
  const file = form.get('file')
  if (!(file instanceof Blob) || file.size > 64 << 20) return editorFailure(413)
  const mediaUID = form.get('media_uid')
  if (mediaUID !== null && !uid.safeParse(mediaUID).success)
    return editorFailure(400)
  form.delete('media_uid')
  if (mediaUID !== null) {
    form.delete('originating_entity_uid')
    form.delete('role')
  }
  const response = await catalogAuthoring(
    session,
    typeof mediaUID === 'string'
      ? `/api/v1/catalog/draft/media/${mediaUID}/file`
      : '/api/v1/catalog/draft/media',
    {
      method: mediaUID === null ? 'POST' : 'PUT',
      headers: { 'Idempotency-Key': key },
      body: form
    }
  )
  return privateJSON(response)
}
