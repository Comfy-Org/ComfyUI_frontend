import type { APIRoute } from 'astro'
import { editorFailure, editorHeaders } from '@/lib/cms/editor-server'

export const GET: APIRoute = (context) => {
  if (!context.locals.catalogAuthoring?.can_apply) return editorFailure(404)
  return new Response(null, {
    status: 303,
    headers: { ...editorHeaders, Location: '/admin/catalog' }
  })
}
