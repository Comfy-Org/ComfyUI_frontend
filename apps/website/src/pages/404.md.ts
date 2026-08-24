import type { APIRoute } from 'astro'

import { notFoundMarkdown } from '../lib/agent-markdown'

export const GET: APIRoute = () =>
  new Response(notFoundMarkdown(), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
