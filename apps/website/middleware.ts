/**
 * Vercel Edge Middleware: Accept-header content negotiation for agents
 * (acceptmarkdown.com contract). Paths ending in a known file extension
 * (assets, `.md` twins, `llms.txt`, sitemaps, `/openapi.json`) are served
 * untouched by the static layer; matching by extension rather than "any dot"
 * keeps dotted page routes like /seedance-2.5 in the negotiation surface.
 * Must stay in sync with the Vary: Accept header rule in vercel.json.
 */

import { negotiateAgentContent } from './src/lib/content-negotiation'

export const config = {
  matcher: [
    '/((?!.*\\.(?:md|txt|xml|json|ico|png|jpg|jpeg|webp|avif|gif|svg|css|js|mjs|map|woff|woff2|ttf|otf|eot|mp4|webm|vtt|pdf|zip|webmanifest)$).*)'
  ]
}

export default function middleware(
  request: Request
): Promise<Response | undefined> {
  return negotiateAgentContent(request)
}
