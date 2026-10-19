// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { PREFIXED_CATALOG_LOCALES } from '@/config/catalog-locales'
import {
  catalogDetailHead,
  catalogDetailNoindex,
  loadCatalogDetailPage
} from '@/lib/cms/detail-page-server'
import { hreflangAlternates } from '@/lib/hreflang'
import { entries } from '@website/scripts/export-cms-seed'

const SITE = new URL('https://comfy.org')
const seed = entries.find((entry) => entry.kind === 'MODEL')
if (!seed?.slug) throw new Error('Expected a model seed record')
const record = seed
const slug = seed.slug

function reviewedTranslations() {
  return Object.fromEntries(
    PREFIXED_CATALOG_LOCALES.map((locale) => [
      locale,
      { title: `${locale} title`, review_state: 'reviewed' }
    ])
  )
}

function serveCatalog(data: Record<string, unknown> = record.data) {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      revision_id: 1,
      generation: 0,
      items: [
        {
          ...record,
          data,
          revision: 1,
          deleted: false,
          edit_version: record.uid
        }
      ]
    })
  )
}

function serveTranslatedCatalog() {
  serveCatalog({
    type: 'model',
    title: 'Source title',
    description: 'Source description',
    compatibility: { website: record.data },
    translations: reviewedTranslations()
  })
}

// The CMS Hub serves every catalog locale. A translated detail page renders on
// the server, keeps its locale in the canonical, and the layout pairs that
// canonical with every other catalog locale (what BaseLayout emits in CMS
// mode for an indexable public page).
describe('localized catalog detail pages', () => {
  it.for(PREFIXED_CATALOG_LOCALES)(
    'server-loads %s with a self canonical and alternates for every locale',
    async (locale) => {
      serveTranslatedCatalog()
      const prefix = locale === 'zh-CN' ? '/zh-CN' : `/${locale}`
      const pathname = `${prefix}${slug}/`
      const load = await loadCatalogDetailPage({}, pathname, locale)
      if (load.status !== 'ok') throw new Error(`${locale}: ${load.status}`)
      expect(catalogDetailNoindex({}, load)).toBe(false)

      const head = catalogDetailHead(load.page, pathname, SITE, locale, locale)
      expect(head.canonicalPath).toBe(`${prefix}${load.page.model.href}`)
      expect(load.page.model.name).toBe(`${locale} title`)

      const href = load.page.model.href
      expect(
        hreflangAlternates(head.canonicalPath, SITE.origin, {
          localizedHub: true
        })
      ).toEqual([
        { hreflang: 'en', href: new URL(href, SITE).href },
        { hreflang: 'zh-CN', href: new URL(`/zh-CN${href}`, SITE).href },
        { hreflang: 'ja', href: new URL(`/ja${href}`, SITE).href },
        { hreflang: 'x-default', href: new URL(href, SITE).href }
      ])
    }
  )

  it.for(PREFIXED_CATALOG_LOCALES)(
    'keeps %s out of the index when the record has no reviewed translation',
    async (locale) => {
      serveCatalog()
      const prefix = locale === 'zh-CN' ? '/zh-CN' : `/${locale}`
      const load = await loadCatalogDetailPage({}, `${prefix}${slug}/`, locale)
      expect(load.status).toBe('ok')
      expect(catalogDetailNoindex({}, load)).toBe(true)
    }
  )

  it('indexes the English page of a record with no translations', async () => {
    serveCatalog()
    const load = await loadCatalogDetailPage({}, `${slug}/`, 'en')
    expect(load.status).toBe('ok')
    expect(catalogDetailNoindex({}, load)).toBe(false)
  })
})
