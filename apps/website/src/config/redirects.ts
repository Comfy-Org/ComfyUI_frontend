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
  // The platform rename, added on main while this branch was open.
  '/api': '/platform/',
  '/zh-CN/api': '/zh-CN/platform/',
  '/platform/router': '/platform/models/',
  '/zh-CN/platform/router': '/zh-CN/platform/models/',
  // Pricing moved out from under /cloud, also from main.
  '/cloud/pricing': '/pricing/',
  '/zh-CN/cloud/pricing': '/zh-CN/pricing/',
  // Affiliates and Terms of Service exist in English only, and used to redirect
  // from their /zh-CN prefix so a reader who swapped the prefix by hand landed
  // on the page rather than a 404.
  //
  // Those three redirects are gone because they cannot coexist with the i18n
  // fallback: Astro gives the fallback route higher priority, drops the
  // redirect, and — this is the dangerous part — only says so in a build WARNING
  // while still exiting 0. The URLs 404ed silently.
  //
  // The fallback covers the same need: /zh-CN/affiliates now renders the English
  // page at that URL with a canonical pointing at /affiliates/, so no reader
  // hits a 404 and Google is still told which one is the original.
  // `redirects.test.ts` fails if such a redirect is reintroduced.
  '/minimax': { status: 307, destination: '/minimax-h3/' },
  '/zh-CN/minimax': { status: 307, destination: '/zh-CN/minimax-h3/' }
} satisfies Record<string, RedirectConfig>
