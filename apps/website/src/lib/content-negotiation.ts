/**
 * Edge-middleware logic behind `middleware.ts`: serve the prebuilt `.md` twin
 * of a page when the Accept header prefers text/markdown, a markdown 404 for
 * nonexistent paths, and 406 when nothing we produce is acceptable
 * (acceptmarkdown.com contract). Kept separate from the middleware entry so
 * vitest can drive it with an injected fetch.
 */

import { negotiate } from './accept'

/**
 * Marks middleware-issued subrequests back into the same deployment so a
 * matcher overlap can never recurse.
 */
export const NEGOTIATION_BYPASS_HEADER = 'x-comfy-content-negotiation'

const SUPPORTED = ['text/html', 'text/markdown'] as const
const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8'

/** `/` → `/index.md`, `/api` and `/api/` → `/api.md`. */
export function markdownTwinPath(pathname: string): string {
  const trimmed =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  if (trimmed === '/' || trimmed === '') return '/index.md'
  if (trimmed.endsWith('.md')) return trimmed
  return `${trimmed}.md`
}

/**
 * Hand the request to the static layer at the twin's path. Serving the file
 * through a rewrite (rather than proxying its body here) keeps correct
 * Content-Type and ETag semantics on both GET and HEAD — Vercel drops entity
 * headers from middleware-constructed HEAD responses. `Vary: Accept` on the
 * negotiated URL comes from the vercel.json header rule; the copy here covers
 * responses the router serves without consulting that rule.
 */
function rewriteToTwin(twinUrl: URL, twinPath: string): Response {
  return new Response(null, {
    headers: {
      'x-middleware-rewrite': twinUrl.toString(),
      'Content-Location': twinPath,
      Vary: 'Accept'
    }
  })
}

function markdownResponse(
  body: BodyInit | null,
  status: number,
  contentLocation: string
): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': MARKDOWN_CONTENT_TYPE,
      'Content-Location': contentLocation,
      Vary: 'Accept',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    }
  })
}

function notAcceptable(accept: string | null): Response {
  const body = [
    'This resource is available in:',
    ...SUPPORTED.map((type) => `- ${type}`),
    '',
    `You requested: ${accept ?? '(no Accept header)'}`,
    ''
  ].join('\n')
  return new Response(body, {
    status: 406,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      Vary: 'Accept',
      'Cache-Control': 'no-store'
    }
  })
}

/**
 * Returns a Response to short-circuit with, or undefined to let the static
 * layer serve the request unchanged.
 */
export async function negotiateAgentContent(
  request: Request,
  fetchImpl: typeof fetch = fetch
): Promise<Response | undefined> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined
  if (request.headers.get(NEGOTIATION_BYPASS_HEADER) !== null) return undefined

  const accept = request.headers.get('accept')
  const { choice, scores } = negotiate(accept, SUPPORTED)
  if (choice === 'text/html') return undefined
  if (choice === null) return notAcceptable(accept)

  const url = new URL(request.url)
  const bypassHeaders = { [NEGOTIATION_BYPASS_HEADER]: '1' }
  const twinPath = markdownTwinPath(url.pathname)
  const twinUrl = new URL(twinPath, url.origin)
  const twinProbe = await fetchImpl(twinUrl.toString(), {
    method: 'HEAD',
    headers: bypassHeaders
  })
  void twinProbe.body?.cancel()
  if (twinProbe.ok) return rewriteToTwin(twinUrl, twinPath)

  // No twin. Redirect sources are answered by the platform's redirect (the
  // target renegotiates); nonexistent paths get the markdown 404 so agents
  // can recover; existing HTML-only pages fall back when the client allows.
  const page = await fetchImpl(
    new URL(url.pathname + url.search, url.origin).toString(),
    { method: 'HEAD', headers: bypassHeaders, redirect: 'manual' }
  )
  void page.body?.cancel()
  if (page.status >= 300 && page.status < 400) return undefined
  if (page.status === 404) {
    const notFoundTwin = await fetchImpl(
      new URL('/404.md', url.origin).toString(),
      { headers: bypassHeaders }
    )
    if (notFoundTwin.ok) {
      return markdownResponse(notFoundTwin.body, 404, '/404.md')
    }
    void notFoundTwin.body?.cancel()
    return undefined
  }
  if ((scores['text/html'] ?? 0) > 0) return undefined
  return notAcceptable(accept)
}
