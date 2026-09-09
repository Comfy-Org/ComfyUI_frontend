import type { RedirectConfig } from 'astro'

/**
 * Astro's redirect map.
 *
 * Trailing slashes on destinations are load-bearing: Astro renders a stub page
 * per redirect whose canonical is the destination string verbatim, and every
 * real page self-canonicalizes with a slash via `absoluteUrl()`. A slash-less
 * destination canonicalizes one hop short of the page it redirects to, which is
 * what #14390 fixed once already.
 *
 * The map lives here rather than inline in `astro.config.ts` so `redirects.test.ts`
 * can assert over the values Astro actually receives. It used to scrape the
 * config's source text, which stopped checking any entry written in a shape the
 * regex did not anticipate.
 */
export const redirects = {
  '/cloud/enterprise': { status: 301, destination: '/enterprise/' },
  '/zh-CN/cloud/enterprise': { status: 301, destination: '/enterprise/' },
  '/cloud/enterprise-case-studies/comfyui-at-architectural-scale-how-moment-factory-reimagined-3d-projection-mapping':
    '/customers/moment-factory/',
  '/cloud/enterprise-case-studies/how-series-entertainment-rebuilt-game-and-video-production-with-comfyui':
    '/customers/series-entertainment/',
  '/zh-CN/terms-of-service': '/terms-of-service/',
  // The platform rename, added on main while this branch was open.
  '/api': '/platform/',
  '/zh-CN/api': '/zh-CN/platform/',
  '/platform/router': '/platform/models/',
  '/zh-CN/platform/router': '/zh-CN/platform/models/',
  // Pricing moved out from under /cloud, also from main.
  '/cloud/pricing': '/pricing/',
  '/zh-CN/cloud/pricing': '/zh-CN/pricing/',
  // Affiliates exists in English only. Without these a reader who swaps the
  // locale prefix by hand gets a 404 instead of the page they asked for.
  '/zh-CN/affiliates': '/affiliates/',
  '/zh-CN/affiliates/terms': '/affiliates/terms/',
  '/minimax': { status: 307, destination: '/minimax-h3/' },
  '/zh-CN/minimax': { status: 307, destination: '/zh-CN/minimax-h3/' },
  // The models catalogue was prototyped under /workshop, and the links to it
  // are already out in Slack, tickets and review threads. /workshop and
  // /workshop/models/[slug] are pages of their own again, so only the paths
  // this prototype added are redirected.
  '/workshop/sign-in': '/models/sign-in/',
  // A dynamic destination names the route, so this one carries no trailing
  // slash: Astro matches it against the page file, not against a URL.
  '/workshop/workflows/[name]': '/models/workflows/[name]'
} satisfies Record<string, RedirectConfig>
