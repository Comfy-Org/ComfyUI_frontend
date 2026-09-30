import type { RedirectConfig } from 'astro'

import { models } from './models'
import {
  HUB_MODELS_PATH,
  hubModelAliases,
  hubModelPath,
  hubModelSlugs,
  hubWorkflowHref,
  hubWorkflowSlugs
} from './hub-models'

interface SiteRedirect {
  /** A literal path with no trailing slash; both slash forms redirect. */
  readonly source: `/${string}`
  /** An internal destination ends in `/`, the form every page canonicalizes to. */
  readonly destination: string
  /** Only a temporary (307) redirect sets this; every other row is a 308. */
  readonly temporaryBecause?: string
  /** Set when `${source}/` is a live page, so only the bare source redirects. */
  readonly slashFormIsPageBecause?: string
}

interface VercelRedirect {
  readonly source: string
  readonly destination: string
  readonly permanent: boolean
}

const MINIMAX_TEMPORARY_BECAUSE =
  '/minimax/ is a live namespace (the license pages sit under it); the page owner signs off before both locales go permanent together'

const modelAliasRedirects = models.flatMap(({ slug, canonicalSlug }) =>
  canonicalSlug
    ? [
        {
          source: `/p/supported-models/${slug}`,
          destination: `/p/supported-models/${canonicalSlug}/`
        } as const
      ]
    : []
)

const HUB_ROUTER_PENDING =
  'switch to permanent once comfy-router#46 is confirmed live on prod; a 308 is cached by browsers and cannot be retracted'

// Literal rows only: hub pages fetch /models/<slug>/page.json, so a /models/:path* catch-all would break them.
const hubModelRedirects: readonly SiteRedirect[] = [
  {
    source: '/models',
    destination: `${HUB_MODELS_PATH}/`,
    temporaryBecause: HUB_ROUTER_PENDING
  },
  ...[...hubModelSlugs, ...hubModelAliases].map(([slug, hubSlug]) => ({
    source: `/models/${slug}` as const,
    destination: hubModelPath(hubSlug),
    temporaryBecause: HUB_ROUTER_PENDING
  })),
  ...hubWorkflowSlugs.map((slug) => ({
    source: `/models/${slug}` as const,
    destination: hubWorkflowHref(slug),
    temporaryBecause: HUB_ROUTER_PENDING
  }))
]

/**
 * Every redirect the website serves. `vercel.json` is generated from this
 * (`pnpm --filter @comfyorg/website sync:redirects`) and a test fails when the
 * two drift, so edit this list and never `vercel.json` by hand.
 */
export const siteRedirects: readonly SiteRedirect[] = [
  {
    source: '/hub',
    destination: `${HUB_MODELS_PATH}/`,
    temporaryBecause: 'the default Hub catalogue can change'
  },
  { source: '/career', destination: '/careers/' },
  { source: '/privacy', destination: '/privacy-policy/' },
  { source: '/press', destination: '/about/' },
  { source: '/blog', destination: 'https://blog.comfy.org/' },
  { source: '/discord', destination: 'https://discord.com/invite/comfyorg' },
  {
    source: '/trust',
    destination: 'https://trust.comfy.org',
    temporaryBecause: 'points at a third-party (Vanta) trust center'
  },
  {
    source: '/login',
    destination: 'https://cloud.comfy.org/cloud/login',
    temporaryBecause: 'hands sign-in off to Comfy Cloud',
    slashFormIsPageBecause: '/login/ is the Workshop sign-in page'
  },
  {
    source: '/share-news',
    destination: 'https://vibe-code-support-page.vercel.app/',
    temporaryBecause: 'a campaign link; a 301 stuck in the edge cache (#18611)'
  },
  {
    source: '/share-news-pleaseeee',
    destination: 'https://vibe-code-support-page.vercel.app/',
    temporaryBecause: 'a campaign link; a 301 stuck in the edge cache (#18611)'
  },
  {
    source: '/minimax',
    destination: '/minimax-h3/',
    temporaryBecause: MINIMAX_TEMPORARY_BECAUSE
  },
  {
    source: '/zh-CN/minimax',
    destination: '/zh-CN/minimax-h3/',
    temporaryBecause: MINIMAX_TEMPORARY_BECAUSE
  },
  { source: '/cloud/enterprise', destination: '/enterprise/' },
  { source: '/zh-CN/cloud/enterprise', destination: '/zh-CN/enterprise/' },
  {
    source:
      '/cloud/enterprise-case-studies/comfyui-at-architectural-scale-how-moment-factory-reimagined-3d-projection-mapping',
    destination: '/customers/moment-factory/'
  },
  {
    source:
      '/cloud/enterprise-case-studies/how-series-entertainment-rebuilt-game-and-video-production-with-comfyui',
    destination: '/customers/series-entertainment/'
  },
  { source: '/zh-CN/terms-of-service', destination: '/terms-of-service/' },
  { source: '/api', destination: '/platform/' },
  { source: '/zh-CN/api', destination: '/zh-CN/platform/' },
  { source: '/platform/models', destination: '/platform/router/' },
  { source: '/zh-CN/platform/models', destination: '/zh-CN/platform/router/' },
  { source: '/cloud/pricing', destination: '/pricing/' },
  { source: '/zh-CN/cloud/pricing', destination: '/zh-CN/pricing/' },
  // Affiliates exists in English only.
  { source: '/zh-CN/affiliates', destination: '/affiliates/' },
  { source: '/zh-CN/affiliates/terms', destination: '/affiliates/terms/' },
  ...modelAliasRedirects,
  ...hubModelRedirects
]

export function isInternalDestination(destination: string): boolean {
  return destination.startsWith('/')
}

const isPermanent = (row: SiteRedirect) => row.temporaryBecause === undefined

const isOldModelsAddress = ({ source }: SiteRedirect) =>
  source === '/models' || source.startsWith('/models/')

const redirectsSlashForm = (row: SiteRedirect) =>
  row.slashFormIsPageBecause === undefined

export function toVercelRedirects(
  rows: readonly SiteRedirect[]
): VercelRedirect[] {
  return rows.flatMap((row) =>
    (redirectsSlashForm(row)
      ? [row.source, `${row.source}/`]
      : [row.source]
    ).map((source) => ({
      source,
      destination: row.destination,
      permanent: isPermanent(row)
    }))
  )
}

/**
 * Astro renders each entry as a meta-refresh stub so `astro preview` and the
 * e2e suite see the redirects; on Vercel the `vercel.json` rule answers first.
 * Astro cannot redirect off-site, and a stub for `/x` is the same file as a
 * page at `/x/`, so those rows live in `vercel.json` only. The old Models
 * addresses are left out too, so the build ships no stub pages under /models.
 */
export const astroRedirects: Record<string, RedirectConfig> =
  Object.fromEntries(
    siteRedirects
      .filter(
        (row) =>
          isInternalDestination(row.destination) &&
          redirectsSlashForm(row) &&
          !isOldModelsAddress(row)
      )
      .map((row) => [
        row.source,
        { status: isPermanent(row) ? 308 : 307, destination: row.destination }
      ])
  )
