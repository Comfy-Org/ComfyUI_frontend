import type { APIRoute } from 'astro'

import { apiMarkdown } from '../lib/agent-markdown'

export const GET: APIRoute = () =>
  new Response(apiMarkdown(), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
