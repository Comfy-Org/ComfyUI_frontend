// @vitest-environment node
import { assert, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import CatalogDetailPage from '@/components/workshop/CatalogDetailPage.vue'
import {
  catalogDetailFailure,
  catalogDetailHead,
  catalogDetailNoindex,
  loadCatalogDetailPage
} from '@/lib/cms/detail-page-server'
import type { AuthoringSession } from '@/lib/cms/authoring-session'
import { auditCatalogDetailBody } from '@website/scripts/models-html-audit'
import { entries } from '@website/scripts/export-cms-seed'

const SITE = new URL('https://comfy.org')
const records = entries.filter((entry) => entry.kind !== 'APP')

// One-record catalog reads, exactly what the route's server load requests.
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

const nativeWorkflow = {
  type: 'workflow',
  title: 'Native workflow',
  description: 'Turns one photo into a product shot.',
  slug: 'native-workflow',
  long_description: 'Upload a photo.\n\nPick a scene and run it.',
  faq: [
    {
      question: 'Which photos work best?',
      answer: 'Well lit photos, see [the guide](https://docs.comfy.org).'
    }
  ],
  model_uids: ['00000000-0000-4000-8000-0000000000aa'],
  website_model_labels: [
    {
      uid: '00000000-0000-4000-8000-0000000000aa',
      title: 'Flux Kontext',
      href: '/hub/models/flux-kontext'
    }
  ]
}
const runInputs = {
  inputSchema: {
    type: 'object',
    properties: { quality: { type: 'number', enum: [1, 2], default: 1 } }
  },
  inputs: {
    quality: {
      label: 'Quality',
      help: '',
      hidden: false,
      advanced: false,
      control: 'dropdown'
    }
  }
}

function serveNativeWorkflow(data: Record<string, unknown>) {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      revision_id: 1,
      generation: 0,
      items: [
        {
          uid: '00000000-0000-4000-8000-000000000031',
          edit_version: '00000000-0000-4000-8000-000000000032',
          kind: 'WORKFLOW',
          slug: '/hub/workflows/native-workflow',
          enabled: true,
          visibility: 'PUBLIC',
          deleted: false,
          revision: 1,
          data
        }
      ]
    })
  )
}

describe('catalog detail pages in server HTML (SEO audit)', () => {
  it('covers both workflow and model records', () => {
    expect(records.some((entry) => entry.kind === 'WORKFLOW')).toBe(true)
    expect(records.some((entry) => entry.kind === 'MODEL')).toBe(true)
  })

  it.for(
    records.map(
      (entry) => [entry.kind, entry.slug, entry.kind === 'WORKFLOW'] as const
    )
  )(
    'server-renders %s %s with its title, h1, description, canonical and JSON-LD (noindex: %s)',
    async ([, slug, noindex]) => {
      serveCatalog()
      const pathname = `${slug}/`
      const load = await loadCatalogDetailPage({}, pathname, 'en')
      if (load.status !== 'ok') throw new Error(`record ${slug} ${load.status}`)
      const { page } = load
      expect(catalogDetailNoindex({}, load)).toBe(noindex)

      const head = catalogDetailHead(page, pathname, SITE, 'en', 'en')
      expect(head.title).toContain(page.model.name)
      expect(head.description.trim()).not.toBe('')
      expect(head.canonicalPath).toBe(page.model.href)
      expect(head.canonicalPath.replace(/\/$/, '')).toBe(slug)
      expect(head.jsonLd.mainEntityId).toBeTruthy()

      const html = await renderToString(
        createSSRApp({
          render: () =>
            h(CatalogDetailPage, {
              path: pathname,
              initial: page,
              locale: 'en'
            })
        })
      )
      expect(auditCatalogDetailBody(html, page.model)).toEqual([])
    }
  )

  it.for([
    { form: 'without a Run form', data: nativeWorkflow },
    { form: 'with a Run form', data: { ...nativeWorkflow, ...runInputs } }
  ])(
    'server-renders a CCC workflow $form with its long description, FAQ and models',
    async ({ data }) => {
      serveNativeWorkflow(data)
      const pathname = '/hub/workflows/native-workflow/'
      const load = await loadCatalogDetailPage({}, pathname, 'en')
      if (load.status !== 'ok') throw new Error(load.status)
      const html = await renderToString(
        createSSRApp({
          render: () =>
            h(CatalogDetailPage, {
              path: pathname,
              initial: load.page,
              locale: 'en'
            })
        })
      )
      expect(auditCatalogDetailBody(html, load.page.model)).toEqual([])
      expect(load.page.model).toMatchObject({
        catalogDetails: {
          longDescription: nativeWorkflow.long_description,
          faqs: [{ question: nativeWorkflow.faq[0].question }],
          models: [{ name: 'Flux Kontext' }]
        }
      })
    }
  )

  it('keeps the locale prefix in the canonical of a localized page', async () => {
    serveCatalog()
    const record = records[0]
    const pathname = `/zh-CN${record.slug}/`
    const load = await loadCatalogDetailPage({}, pathname, 'zh-CN')
    if (load.status !== 'ok') throw new Error(load.status)
    const head = catalogDetailHead(load.page, pathname, SITE, 'zh-CN', 'zh-CN')
    expect(head.canonicalPath).toBe(`/zh-CN${load.page.model.href}`)
  })

  it('reports an unknown record as missing and keeps it out of the index', async () => {
    serveCatalog()
    const load = await loadCatalogDetailPage(
      {},
      '/hub/workflows/does-not-exist/',
      'en'
    )
    expect(load.status).toBe('missing')
    expect(catalogDetailNoindex({}, load)).toBe(true)
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(CatalogDetailPage, {
            path: '/hub/workflows/does-not-exist/',
            initialMissing: true,
            locale: 'en'
          })
      })
    )
    expect(html).toContain('Content not found')
    expect(html).not.toContain('catalog-detail-loading')
  })

  it('reports an upstream failure as unavailable, never as a page', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 503 }))
    const load = await loadCatalogDetailPage({}, `${records[0].slug}/`, 'en')
    expect(load.status).toBe('unavailable')
    expect(catalogDetailNoindex({}, load)).toBe(true)
  })

  it('answers an upstream failure with a retryable 503, not a 200 page', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 503 }))
    const load = await loadCatalogDetailPage({}, `${records[0].slug}/`, 'en')
    const response = catalogDetailFailure(load)
    expect(response?.status).toBe(503)
    expect(response?.headers.get('Retry-After')).toBe('5')
  })

  it.for([
    { status: 'ok', pathname: `${records[0].slug}/` },
    { status: 'missing', pathname: '/hub/workflows/does-not-exist/' }
  ])(
    'renders a page for a $status record instead of failing the request',
    async ({ status, pathname }) => {
      serveCatalog()
      const load = await loadCatalogDetailPage({}, pathname, 'en')
      expect(load.status).toBe(status)
      expect(catalogDetailFailure(load)).toBeUndefined()
    }
  )

  it.for([
    { locale: 'en', prefix: '' },
    { locale: 'zh-CN', prefix: '/zh-CN' },
    { locale: 'ja', prefix: '/ja' }
  ] as const)(
    'keeps an unlaunched workflow page out of the index in $locale',
    async ({ locale, prefix }) => {
      serveCatalog()
      const workflow = records.find((entry) => entry.kind === 'WORKFLOW')
      assert.exists(workflow)
      const load = await loadCatalogDetailPage(
        {},
        `${prefix}${workflow.slug}/`,
        locale
      )
      expect(load.status).toBe('ok')
      expect(catalogDetailNoindex({}, load)).toBe(true)
    }
  )

  it('never indexes a staff view, which can show unpublished Draft content', async () => {
    serveCatalog()
    const load = await loadCatalogDetailPage({}, `${records[0].slug}/`, 'en')
    const staff = { catalogAuthoring: {} as AuthoringSession }
    expect(catalogDetailNoindex(staff, load)).toBe(true)
  })

  it('rejects paths that are not catalog detail routes', async () => {
    serveCatalog()
    const load = await loadCatalogDetailPage({}, '/hub/apps/x/', 'en')
    expect(load.status).toBe('missing')
    expect(fetch).not.toHaveBeenCalled()
  })
})
