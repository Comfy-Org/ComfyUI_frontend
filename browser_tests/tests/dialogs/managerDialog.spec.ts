import { expect } from '@playwright/test'

import type { AlgoliaNodePack } from '@/types/algoliaTypes'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'
import type { components as RegistryComponents } from '@comfyorg/registry-types'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'

type InstalledPacksResponse =
  ManagerComponents['schemas']['InstalledPacksResponse']
type RegistryNodePack = RegistryComponents['schemas']['Node']

interface AlgoliaSearchResult {
  hits: Partial<AlgoliaNodePack>[]
  nbHits: number
  page: number
  nbPages: number
  hitsPerPage: number
}

interface AlgoliaSearchResponse {
  results: AlgoliaSearchResult[]
}

const MOCK_PACK_A: RegistryNodePack = {
  id: 'test-pack-a',
  name: 'Test Pack A',
  description: 'A test custom node pack',
  downloads: 5000,
  status: 'NodeStatusActive',
  publisher: { id: 'test-publisher', name: 'Test Publisher' },
  latest_version: { version: '1.0.0', status: 'NodeVersionStatusActive' },
  repository: 'https://github.com/test/pack-a',
  tags: ['image', 'processing']
}

const MOCK_PACK_B: RegistryNodePack = {
  id: 'test-pack-b',
  name: 'Test Pack B',
  description: 'Another test custom node pack for testing search',
  downloads: 3000,
  status: 'NodeStatusActive',
  publisher: { id: 'another-publisher', name: 'Another Publisher' },
  latest_version: { version: '2.1.0', status: 'NodeVersionStatusActive' },
  repository: 'https://github.com/test/pack-b',
  tags: ['video', 'generation']
}

const MOCK_PACK_C: RegistryNodePack = {
  id: 'test-pack-c',
  name: 'Test Pack C',
  description: 'Third test pack',
  downloads: 100,
  status: 'NodeStatusActive',
  publisher: { id: 'test-publisher', name: 'Test Publisher' },
  latest_version: { version: '0.5.0', status: 'NodeVersionStatusActive' },
  repository: 'https://github.com/test/pack-c'
}

const MOCK_INSTALLED_PACKS: InstalledPacksResponse = {
  'test-pack-a': {
    ver: '1.0.0',
    cnr_id: 'test-pack-a',
    enabled: true
  },
  'test-pack-c': {
    ver: '0.5.0',
    cnr_id: 'test-pack-c',
    enabled: false
  }
}

const MOCK_HIT_A: Partial<AlgoliaNodePack> = {
  objectID: 'test-pack-a',
  id: 'test-pack-a',
  name: 'Test Pack A',
  description: 'A test custom node pack',
  total_install: 5000,
  status: 'NodeStatusActive',
  publisher_id: 'test-publisher',
  latest_version: '1.0.0',
  latest_version_status: 'NodeVersionStatusActive',
  repository_url: 'https://github.com/test/pack-a',
  comfy_nodes: ['TestNodeA1', 'TestNodeA2'],
  create_time: '2024-01-01T00:00:00Z',
  update_time: '2024-06-01T00:00:00Z',
  license: 'MIT',
  tags: ['image', 'processing']
}

const MOCK_HIT_B: Partial<AlgoliaNodePack> = {
  objectID: 'test-pack-b',
  id: 'test-pack-b',
  name: 'Test Pack B',
  description: 'Another test custom node pack for testing search',
  total_install: 3000,
  status: 'NodeStatusActive',
  publisher_id: 'another-publisher',
  latest_version: '2.1.0',
  latest_version_status: 'NodeVersionStatusActive',
  repository_url: 'https://github.com/test/pack-b',
  comfy_nodes: ['TestNodeB1'],
  create_time: '2024-02-01T00:00:00Z',
  update_time: '2024-07-01T00:00:00Z',
  license: 'Apache-2.0',
  tags: ['video', 'generation']
}

const MOCK_HIT_C: Partial<AlgoliaNodePack> = {
  objectID: 'test-pack-c',
  id: 'test-pack-c',
  name: 'Test Pack C',
  description: 'Third test pack',
  total_install: 100,
  status: 'NodeStatusActive',
  publisher_id: 'test-publisher',
  latest_version: '0.5.0',
  latest_version_status: 'NodeVersionStatusActive',
  repository_url: 'https://github.com/test/pack-c',
  comfy_nodes: ['TestNodeC1'],
  create_time: '2024-03-01T00:00:00Z',
  update_time: '2024-05-01T00:00:00Z',
  license: 'MIT'
}

const MOCK_ALGOLIA_RESPONSE: AlgoliaSearchResponse = {
  results: [
    {
      hits: [MOCK_HIT_A, MOCK_HIT_B, MOCK_HIT_C],
      nbHits: 3,
      page: 0,
      nbPages: 1,
      hitsPerPage: 20
    }
  ]
}

const MOCK_ALGOLIA_PACK_B_ONLY: AlgoliaSearchResponse = {
  results: [
    {
      hits: [MOCK_HIT_B],
      nbHits: 1,
      page: 0,
      nbPages: 1,
      hitsPerPage: 20
    }
  ]
}

const MOCK_ALGOLIA_EMPTY: AlgoliaSearchResponse = {
  results: [
    {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 20
    }
  ]
}

test.describe('ManagerDialog', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    const statsWithManager = {
      ...mockSystemStats,
      system: {
        ...mockSystemStats.system,
        argv: ['main.py', '--listen', '0.0.0.0', '--enable-manager']
      }
    }
    await comfyPage.page.route('**/system_stats**', async (route) => {
      await route.fulfill({ json: statsWithManager })
    })

    await comfyPage.featureFlags.mockServerFeatures({
      'extension.manager.supports_v4': true
    })

    await comfyPage.page.route(
      '**/v2/customnode/installed**',
      async (route) => {
        await route.fulfill({ json: MOCK_INSTALLED_PACKS })
      }
    )

    await comfyPage.page.route(
      '**/v2/manager/queue/status**',
      async (route) => {
        await route.fulfill({
          json: {
            history: {},
            running_queue: [],
            pending_queue: [],
            installed_packs: {}
          }
        })
      }
    )

    await comfyPage.page.route(
      '**/v2/manager/queue/history**',
      async (route) => {
        await route.fulfill({ json: {} })
      }
    )

    await comfyPage.page.route('**/*.algolia.net/**', async (route) => {
      await route.fulfill({ json: MOCK_ALGOLIA_RESPONSE })
    })

    await comfyPage.page.route('**/*.algolianet.com/**', async (route) => {
      await route.fulfill({ json: MOCK_ALGOLIA_RESPONSE })
    })

    // Mock Comfy Registry API (fallback when Algolia credentials are unavailable)
    const registryListResponse = {
      total: 3,
      nodes: [MOCK_PACK_A, MOCK_PACK_B, MOCK_PACK_C],
      page: 1,
      limit: 64,
      totalPages: 1
    }

    await comfyPage.page.route(
      '**/api.comfy.org/nodes/search**',
      async (route) => {
        await route.fulfill({ json: registryListResponse })
      }
    )

    await comfyPage.page.route(
      (url) => url.hostname === 'api.comfy.org' && url.pathname === '/nodes',
      async (route) => {
        await route.fulfill({ json: registryListResponse })
      }
    )

    await comfyPage.page.route(
      '**/v2/customnode/getmappings**',
      async (route) => {
        await route.fulfill({ json: {} })
      }
    )

    await comfyPage.page.route(
      '**/v2/customnode/import_fail_info**',
      async (route) => {
        await route.fulfill({ json: {} })
      }
    )

    await comfyPage.setup()
  })

  async function openManagerDialog(comfyPage: ComfyPage) {
    await comfyPage.command.executeCommand('Comfy.OpenManagerDialog')
  }

  test('Opens the manager dialog via command', async ({ comfyPage }) => {
    await openManagerDialog(comfyPage)

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()
  })

  test('Displays pack cards from search results', async ({ comfyPage }) => {
    await openManagerDialog(comfyPage)

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await expect(dialog.getByText('Test Pack A')).toBeVisible()
    await expect(dialog.getByText('Test Pack B')).toBeVisible()
    await expect(dialog.getByText('Test Pack C')).toBeVisible()
  })

  test('Search filters displayed packs', async ({ comfyPage }) => {
    await comfyPage.page.route('**/*.algolia.net/**', async (route) => {
      await route.fulfill({ json: MOCK_ALGOLIA_PACK_B_ONLY })
    })
    await comfyPage.page.route('**/*.algolianet.com/**', async (route) => {
      await route.fulfill({ json: MOCK_ALGOLIA_PACK_B_ONLY })
    })
    await comfyPage.page.route(
      '**/api.comfy.org/nodes/search**',
      async (route) => {
        await route.fulfill({
          json: {
            total: 1,
            nodes: [MOCK_PACK_B],
            page: 1,
            limit: 64,
            totalPages: 1
          }
        })
      }
    )

    await openManagerDialog(comfyPage)

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const searchInput = dialog.getByPlaceholder(/search/i)
    await searchInput.fill('Test Pack B')

    await expect(dialog.getByText('Test Pack B')).toBeVisible()
    await expect(dialog.getByText('Test Pack A')).toBeHidden()
  })

  test('Clicking a pack card opens the info panel', async ({ comfyPage }) => {
    await comfyPage.page.route(
      '**/api.comfy.org/nodes/test-pack-a',
      async (route) => {
        await route.fulfill({ json: MOCK_PACK_A })
      }
    )

    await openManagerDialog(comfyPage)

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByText('Test Pack A').first().click()

    await expect(dialog.getByText('Test Publisher').first()).toBeVisible()
  })

  test('Left side panel navigation tabs exist', async ({ comfyPage }) => {
    await openManagerDialog(comfyPage)

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const nav = dialog.locator('nav')
    await expect(nav.getByText('All Extensions')).toBeVisible()
    await expect(nav.getByText('Not Installed')).toBeVisible()
    await expect(nav.getByText('All Installed')).toBeVisible()
    await expect(nav.getByText('Updates Available')).toBeVisible()
  })

  test('Switching tabs changes the content view', async ({ comfyPage }) => {
    await openManagerDialog(comfyPage)

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const nav = dialog.locator('nav')
    await nav.getByText('All Installed').click()

    await expect(dialog.getByText('Test Pack A')).toBeVisible()
  })

  test('Closes via Escape key', async ({ comfyPage }) => {
    await openManagerDialog(comfyPage)

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('Empty search shows no results message', async ({ comfyPage }) => {
    await comfyPage.page.route('**/*.algolia.net/**', async (route) => {
      await route.fulfill({ json: MOCK_ALGOLIA_EMPTY })
    })
    await comfyPage.page.route('**/*.algolianet.com/**', async (route) => {
      await route.fulfill({ json: MOCK_ALGOLIA_EMPTY })
    })
    await comfyPage.page.route(
      '**/api.comfy.org/nodes/search**',
      async (route) => {
        await route.fulfill({
          json: {
            total: 0,
            nodes: [],
            page: 1,
            limit: 64,
            totalPages: 0
          }
        })
      }
    )

    await openManagerDialog(comfyPage)

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const searchInput = dialog.getByPlaceholder(/search/i)
    await searchInput.fill('nonexistent-pack-xyz-999')

    await expect(
      dialog.getByText(/no results found|try a different search/i).first()
    ).toBeVisible()
  })

  test('Search mode can be switched between packs and nodes', async ({
    comfyPage
  }) => {
    await openManagerDialog(comfyPage)

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const modeSelector = dialog.getByText('Node Pack').first()
    await expect(modeSelector).toBeVisible()

    await modeSelector.click()
    const nodesOption = comfyPage.page.getByRole('option', { name: 'Nodes' })
    await expect(nodesOption).toBeVisible()
    await nodesOption.click()
  })
})
