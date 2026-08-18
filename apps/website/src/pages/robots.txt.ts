import type { APIRoute } from 'astro'

// The preview deployment (PREVIEW_MODE=true) must never be indexed, so it serves
// a disallow-all robots.txt. Production serves the real, crawler-open file. This
// endpoint replaces a static `public/robots.txt` so the two builds can differ.
// (Belt-and-suspenders with the PREVIEW_MODE `X-Robots-Tag` + meta in BaseLayout.)

const PRODUCTION_ROBOTS = `# robots.txt for comfy.org
# Open to all crawlers — including AI/LLM bots — for maximum visibility
# in AI-powered search, chat-based answer engines, and traditional search.
# Granular UAs are listed explicitly to signal intent; rules are shared
# via stacked user-agent records (RFC 9309 §2.2).

User-agent: *
User-agent: Googlebot
User-agent: Bingbot
User-agent: DuckDuckBot
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: OAI-SearchBot
User-agent: Google-Extended
User-agent: ClaudeBot
User-agent: Claude-Web
User-agent: anthropic-ai
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Applebot
User-agent: Applebot-Extended
User-agent: Bytespider
User-agent: Amazonbot
User-agent: CCBot
User-agent: Meta-ExternalAgent
User-agent: Meta-ExternalFetcher
User-agent: Diffbot
Allow: /
Disallow: /_astro/
Disallow: /_website/
Disallow: /_vercel/

Sitemap: https://comfy.org/sitemap-index.xml
`

const PREVIEW_ROBOTS = `# Preview deployment — never index.
User-agent: *
Disallow: /
`

export const GET: APIRoute = () => {
  const body =
    import.meta.env.PREVIEW_MODE === 'true' ? PREVIEW_ROBOTS : PRODUCTION_ROBOTS
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
