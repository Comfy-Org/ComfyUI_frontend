import type { APIRoute } from 'astro'

import { homepageMarkdown } from '../lib/agent-markdown'

export const GET: APIRoute = () =>
  new Response(homepageMarkdown(), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
