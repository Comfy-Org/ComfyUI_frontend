/**
 * Fails when a published model page leaves the build without a permanent
 * redirect to a live page. Reads the built sitemap, so run it after a build.
 * `--record` adds new model pages to the published list; it never drops one.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

import { websiteRoot } from '@website/paths'
import { LOCALE_CODES, LOCALES } from '@/config/locales'
import { modelsUrlRoots } from '@/config/models-url-registry'
import { routeOfHref, sitemapChunkNames } from '@/utils/hreflangAudit'
import {
  auditPublishedModelPages,
  isModelPagePath,
  recordModelPages,
  unrecordedModelPages
} from './published-model-pages'

const ORIGIN = 'https://comfy.org'
const DIST = join(websiteRoot, 'dist')
const PUBLISHED_PATH = join(
  websiteRoot,
  'src',
  'config',
  'published-model-pages.json'
)
const MODEL_PAGE_ROOTS = [...modelsUrlRoots, '/p/supported-models']
const RECORD_COMMAND =
  'pnpm --filter @comfyorg/website record:published-model-pages'

const RETIRED_WITHOUT_REDIRECT: Record<string, string> = {}

const VercelConfigSchema = z.object({
  redirects: z.array(
    z.object({
      source: z.string(),
      destination: z.string(),
      permanent: z.boolean()
    })
  )
})

function sitemapPages(): Set<string> {
  const indexPath = join(DIST, 'sitemap-index.xml')
  if (!existsSync(indexPath))
    throw new Error(
      `[published-model-pages] ${indexPath} is missing; build first`
    )
  const chunks = sitemapChunkNames(readFileSync(indexPath, 'utf-8'))
  const xml = chunks
    .map((name) => readFileSync(join(DIST, name), 'utf-8'))
    .join('')
  return new Set(
    Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), ([, loc]) =>
      routeOfHref(loc.trim(), ORIGIN)
    )
  )
}

const live = sitemapPages()
const liveModelPages = [...live].filter((page) =>
  isModelPagePath(
    page,
    MODEL_PAGE_ROOTS,
    LOCALE_CODES.map((code) => LOCALES[code].prefix)
  )
)
const recorded = z
  .array(z.string())
  .parse(JSON.parse(readFileSync(PUBLISHED_PATH, 'utf-8')))
const record = process.argv.includes('--record')
const published = record ? recordModelPages(recorded, liveModelPages) : recorded

if (record)
  writeFileSync(PUBLISHED_PATH, `${JSON.stringify(published, null, 2)}\n`)

const { redirects } = VercelConfigSchema.parse(
  JSON.parse(readFileSync(join(websiteRoot, 'vercel.json'), 'utf-8'))
)
const errors = [
  ...auditPublishedModelPages({
    published,
    live,
    redirects,
    retiredWithoutRedirect: RETIRED_WITHOUT_REDIRECT
  }),
  ...unrecordedModelPages(published, liveModelPages).map(
    (page) => `${page} is new: run \`${RECORD_COMMAND}\` after a build`
  )
]

if (errors.length > 0) {
  console.error(`[published-model-pages] ${errors.length} problem(s):`)
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}
console.warn(
  `[published-model-pages] ${published.length} published model pages are live or redirect permanently to a live page.`
)
