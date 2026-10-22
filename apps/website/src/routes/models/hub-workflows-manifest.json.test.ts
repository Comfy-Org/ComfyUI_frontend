import { expect, it, vi } from 'vitest'
import { GET } from './hub-workflows-manifest.json'
import { loadSiteCatalogList } from '@/lib/cms/catalog-list'
import { workflowModels } from '@/config/workshop-workflow-content'
import { modelSchema } from '@/config/models-catalogue-data'
import hubWorkflowNames from '@/config/hub-workflow-names.json' with { type: 'json' }
import { buildHubWorkflowsManifest } from '@/config/hub-workflows-manifest'
import { hubWorkflowsRouting } from '@/config/hub-workflows-routing'

vi.mock(import('@/lib/cms/catalog-list'))

function catalogPage(name: string, nextCursor?: string, reset = false) {
  const page = {
    page: 1,
    pageSize: 24,
    hasPrevious: false,
    hasNext: Boolean(nextCursor),
    nextCursor,
    reset
  }
  return {
    ok: true as const,
    models: [
      modelSchema.parse({
        ...workflowModels[0],
        href: '/hub/workflows/' + name
      })
    ],
    pages: { models: page, workflows: page, apps: page },
    facets: {
      models: { useCases: [], sortOrders: [] },
      workflows: { categories: [], models: [] }
    }
  }
}

it('keeps the static workflow manifest unchanged without CMS', async () => {
  vi.stubEnv('SITE_CATALOG_API_URL', '')
  expect(await (await GET()).json()).toEqual(
    buildHubWorkflowsManifest(hubWorkflowNames, hubWorkflowsRouting)
  )
  expect(loadSiteCatalogList).not.toHaveBeenCalled()
})

it('fails closed rather than leaking a static manifest on CMS failure', async () => {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.mocked(loadSiteCatalogList).mockResolvedValue({ ok: false, status: 503 })
  const response = await GET()
  expect(response.status).toBe(503)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})

it('includes only currently eligible workflow destinations and redirects', async () => {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  const name = hubWorkflowNames[0]
  vi.mocked(loadSiteCatalogList).mockResolvedValue(catalogPage(name))
  const destinations = new Set(['/hub/workflows/' + name + '/'])
  const expected = buildHubWorkflowsManifest([name], {
    ...hubWorkflowsRouting,
    legacyRedirects: Object.fromEntries(
      Object.entries(hubWorkflowsRouting.legacyRedirects).filter(([, to]) =>
        destinations.has(to)
      )
    )
  })
  expect(await (await GET()).json()).toEqual(expected)
})

it('reads every bounded page and refuses repeated cursors or snapshot resets', async () => {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  const [first, second] = hubWorkflowNames
  const loader = vi.mocked(loadSiteCatalogList)
  loader
    .mockResolvedValueOnce(catalogPage(first, 'next'))
    .mockResolvedValueOnce(catalogPage(second))
  const response = await GET()
  expect(response.status).toBe(200)
  const body = JSON.stringify(await response.json())
  expect(body).toContain(first)
  expect(body).toContain(second)
  loader.mockResolvedValue(catalogPage(first, 'repeated'))
  expect((await GET()).status).toBe(503)
  loader
    .mockResolvedValueOnce(catalogPage(first, 'next'))
    .mockResolvedValueOnce(catalogPage(second, undefined, true))
  expect((await GET()).status).toBe(503)
})
