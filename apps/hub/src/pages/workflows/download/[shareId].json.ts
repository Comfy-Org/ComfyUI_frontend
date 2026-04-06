export const prerender = false

import type { APIRoute } from 'astro'
import { getWorkflow } from '../../../lib/hub-api'

function sanitizeFilename(raw: string): string {
  return (
    raw
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'workflow'
  )
}

export const GET: APIRoute = async ({ params, request }) => {
  const shareId = params.shareId
  if (!shareId) {
    return new Response('Missing workflow shareId', { status: 400 })
  }

  try {
    const workflow = await getWorkflow(shareId)
    if (!workflow.workflow_json) {
      return new Response('Workflow JSON not available', { status: 404 })
    }

    const url = new URL(request.url)
    const requestedFilename = url.searchParams.get('filename')
    const baseFilename = requestedFilename || workflow.share_id
    const filename = `${sanitizeFilename(baseFilename)}.json`

    return new Response(JSON.stringify(workflow.workflow_json, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'CDN-Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
        'Cache-Control': 'public, max-age=60'
      }
    })
  } catch (error) {
    const status =
      error instanceof Error && error.message.includes('404') ? 404 : 502
    return new Response('Failed to fetch workflow JSON from Hub API', {
      status
    })
  }
}
