import { expect, it, vi } from 'vitest'
import { GET } from './hub-workflows-manifest.json'
import { loadSiteCatalog } from '@/lib/cms/catalog'
import hubWorkflowNames from '@/config/hub-workflow-names.json' with { type: 'json' }
import { buildHubWorkflowsManifest } from '@/config/hub-workflows-manifest'
import { hubWorkflowsRouting } from '@/config/hub-workflows-routing'

vi.mock(import('@/lib/cms/catalog'), { spy: true })

it('keeps the static workflow manifest unchanged without CMS', async () => {
  vi.stubEnv('SITE_CATALOG_API_URL', '')
  expect(await (await GET()).json()).toEqual(
    buildHubWorkflowsManifest(hubWorkflowNames, hubWorkflowsRouting)
  )
  expect(loadSiteCatalog).not.toHaveBeenCalled()
})

it('fails closed rather than leaking a static manifest on CMS failure', async () => {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.mocked(loadSiteCatalog).mockResolvedValue({ ok: false, status: 503 })
  const response = await GET()
  expect(response.status).toBe(503)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})

it('includes only currently eligible workflow destinations and redirects', async () => {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  const name = hubWorkflowNames[0]
  vi.mocked(loadSiteCatalog).mockResolvedValue({
    ok: true,
    models: [],
    details: [],
    projection: {
      revision_id: 1,
      generation: 1,
      items: [
        {
          uid: 'test-workflow',
          revision: 1,
          edit_version: 'test-version',
          kind: 'WORKFLOW',
          slug: '/hub/workflows/' + name,
          enabled: true,
          deleted: false,
          visibility: 'PUBLIC',
          data: {}
        }
      ]
    }
  })
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
