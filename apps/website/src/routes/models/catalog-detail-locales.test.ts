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
const record = entries.find((entry) => entry.kind === 'WORKFLOW')
if (!record?.slug) throw new Error('Expected a workflow seed record')
const slug = record.slug

function serveCatalog() {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.mocked(fetch).mockImplementation((input) => {
    const url = new URL(String(input))
    const item = entries.find(
      (entry) => entry.slug === url.searchParams.get('workflow_slug')
    )
    return Promise.resolve(
      Response.json({
        revision_id: 1,
        generation: 0,
        items: item
          ? [{ ...item, revision: 1, deleted: false, edit_version: item.uid }]
          : []
      })
    )
  })
}

// The CMS Hub serves every catalog locale. A localized detail page renders on
// the server, keeps its locale in the canonical, and the layout pairs that
// canonical with every other catalog locale (what BaseLayout emits in CMS
// mode for an indexable public page).
describe('localized catalog detail pages', () => {
  it.for(PREFIXED_CATALOG_LOCALES)(
    'server-loads %s with a self canonical and alternates for every locale',
    async (locale) => {
      serveCatalog()
      const prefix = locale === 'zh-CN' ? '/zh-CN' : `/${locale}`
      const pathname = `${prefix}${slug}/`
      const load = await loadCatalogDetailPage({}, pathname, locale)
      if (load.status !== 'ok') throw new Error(`${locale}: ${load.status}`)
      expect(catalogDetailNoindex({}, load)).toBe(false)

      const head = catalogDetailHead(load.page, pathname, SITE, locale, locale)
      expect(head.canonicalPath).toBe(`${prefix}${load.page.model.href}`)

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
})
