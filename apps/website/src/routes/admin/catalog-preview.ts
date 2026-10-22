import type { APIRoute } from 'astro'
import { validAuthoringMutation } from '@/lib/cms/authoring-session'
import {
  boundedBody,
  editorFailure,
  editorHeaders
} from '@/lib/cms/editor-server'
import { commitCatalogPreview, previewCommand } from '@/lib/cms/catalog-preview'

export const POST: APIRoute = async (context) => {
  if (!context.locals.catalogAuthoring) return editorFailure(404)
  if (context.url.search || !validAuthoringMutation(context))
    return editorFailure(403)
  if (
    !context.request.headers.get('Content-Type')?.startsWith('application/json')
  )
    return editorFailure(415)
  const bytes = await boundedBody(context.request, 4096)
  if (!bytes) return editorFailure(413)
  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return editorFailure(400)
  }
  const parsed = previewCommand.safeParse(raw)
  if (!parsed.success) return editorFailure(400)
  commitCatalogPreview(context, parsed.data)
  return new Response(null, { status: 204, headers: editorHeaders })
}
