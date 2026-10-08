import type { RedirectConfig } from 'astro'
import { groupBy, mapValues } from 'es-toolkit'

import {
  HUB_MODELS_PATH,
  hubAppHref,
  hubAppSlugs,
  hubModelAliases,
  hubModelPath,
  hubModelSlugs,
  hubWorkflowHref,
  hubWorkflowSlugs
} from './hub-models'
import {
  LOCAL_MODELS_PATH,
  localModelAliases,
  localModelPath,
  localModels
} from './local-models'
import { markdownTwinPath } from '@/lib/markdown-twin-path'
import { partnerModelHubSlugs } from './partner-model-redirects'

interface SiteRedirect {
  /**
   * A path with no trailing slash, literal or with one `:slug(a|b)` group;
   * both slash forms redirect, except for a `.md` or `.txt` file.
   */
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

const SUPPORTED_MODELS_PATH = '/p/supported-models'

/** Leaves room under Vercel's 2,048-character limit on a rule's source. */
const MAX_SLUG_GROUP_LENGTH = 1900

export function slugGroups(slugs: readonly string[]): string[] {
  const groups: string[][] = []
  for (const slug of slugs) {
    const group = groups.at(-1)
    if (group && [...group, slug].join('|').length <= MAX_SLUG_GROUP_LENGTH)
      group.push(slug)
    else groups.push([slug])
  }
  return groups.map((group) => group.join('|'))
}

const supportedModelPath = (slug: string) =>
  `${SUPPORTED_MODELS_PATH}/${slug}` as const

/** A local file slug a data refresh removed → the page that replaces it. */
export const retiredLocalModelPages: Readonly<Record<string, string>> = {}

const partnerModelPage = (hubSlug: string | null) =>
  hubSlug ? hubModelPath(hubSlug) : `${HUB_MODELS_PATH}/`

const movedModelPages: Readonly<Record<string, string>> = {
  ...mapValues(partnerModelHubSlugs, partnerModelPage),
  ...retiredLocalModelPages
}

function slugGroupRedirects(
  slugs: readonly string[],
  page: string
): SiteRedirect[] {
  return slugGroups(slugs).flatMap((group) => [
    { source: supportedModelPath(`:slug(${group})`), destination: page },
    {
      source: supportedModelPath(`:slug(${group}).md`),
      destination: markdownTwinPath(page)
    }
  ])
}

const supportedModelRedirects: readonly SiteRedirect[] = [
  { source: SUPPORTED_MODELS_PATH, destination: `${LOCAL_MODELS_PATH}/` },
  {
    source: `${SUPPORTED_MODELS_PATH}.md`,
    destination: `${LOCAL_MODELS_PATH}.md`
  },
  {
    source: supportedModelPath('llms.txt'),
    destination: `${LOCAL_MODELS_PATH}/llms.txt`
  },
  ...localModelAliases.flatMap(({ slug, canonicalSlug }) =>
    canonicalSlug
      ? [
          {
            source: supportedModelPath(slug),
            destination: localModelPath(canonicalSlug)
          }
        ]
      : []
  ),
  ...Object.entries(
    groupBy(Object.keys(movedModelPages), (slug) => movedModelPages[slug])
  ).flatMap(([page, slugs]) => slugGroupRedirects(slugs, page)),
  ...slugGroupRedirects(
    localModels.map(({ slug }) => slug),
    `${LOCAL_MODELS_PATH}/:slug/`
  )
]

// Permanent since comfy-router#46: prod serves /hub/models, /hub/workflows and /hub/apps from this site.
// 308 tells search engines the move is permanent: confirm a new destination serves 200 first.
// Literal rows only: hub pages fetch /models/<slug>/page.json, so a /models/:path* catch-all would break them.
const hubModelRedirects: readonly SiteRedirect[] = [
  { source: '/models', destination: `${HUB_MODELS_PATH}/` },
  ...[...hubModelSlugs, ...hubModelAliases].map(([slug, hubSlug]) => ({
    source: `/models/${slug}` as const,
    destination: hubModelPath(hubSlug)
  })),
  ...hubWorkflowSlugs.map((slug) => ({
    source: `/models/${slug}` as const,
    destination: hubWorkflowHref(slug)
  })),
  ...hubAppSlugs.map((slug) => ({
    source: `/models/${slug}` as const,
    destination: hubAppHref(slug)
  }))
]

/**
 * Every redirect the website serves. `vercel.json` is generated from this
 * (`pnpm --filter @comfyorg/website sync:redirects`) and a test fails when the
 * two drift, so edit this list and never `vercel.json` by hand.
 */
export const siteRedirects: readonly SiteRedirect[] = [
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
  ...supportedModelRedirects,
  ...hubModelRedirects
]

export function isInternalDestination(destination: string): boolean {
  return destination.startsWith('/')
}

const isPermanent = (row: SiteRedirect) => row.temporaryBecause === undefined

const RETIRED_ROOTS = ['/models', SUPPORTED_MODELS_PATH]

const isRetiredAddress = ({ source }: SiteRedirect) =>
  RETIRED_ROOTS.some(
    (root) =>
      source === root ||
      source.startsWith(`${root}/`) ||
      source.startsWith(`${root}.`)
  )

const redirectsSlashForm = (row: SiteRedirect) =>
  row.slashFormIsPageBecause === undefined

const isFileAddress = (source: string) => /\.(md|txt)$/.test(source)

export function toVercelRedirects(
  rows: readonly SiteRedirect[]
): VercelRedirect[] {
  return rows.flatMap((row) =>
    (redirectsSlashForm(row) && !isFileAddress(row.source)
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
 * page at `/x/`, so those rows live in `vercel.json` only. The retired
 * /models and /p/supported-models addresses are left out too, so the build
 * ships no stub pages under them.
 */
export const astroRedirects: Record<string, RedirectConfig> =
  Object.fromEntries(
    siteRedirects
      .filter(
        (row) =>
          isInternalDestination(row.destination) &&
          redirectsSlashForm(row) &&
          !isRetiredAddress(row)
      )
      .map((row) => [
        row.source,
        { status: isPermanent(row) ? 308 : 307, destination: row.destination }
      ])
  )
