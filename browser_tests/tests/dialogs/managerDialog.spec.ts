import type { Locator } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import type { AlgoliaNodePack } from '@/types/algoliaTypes'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'
import type {
  components as RegistryComponents,
  operations as RegistryOperations
} from '@comfyorg/registry-types'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

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
  latest_version: { version: '2.1.0', status: 'NodeVersionStatusFlagged' },
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
  latest_version_status: 'NodeVersionStatusFlagged',
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

// Must exceed the widest column count under test, or the right-hand edge of
// the grid is empty and the overflow assertions pass vacuously.
const SIZING_PACKS: RegistryNodePack[] = Array.from(
  { length: 24 },
  (_, index) => ({
    id: `sizing-pack-${index}`,
    name: `Sizing Pack ${index}`,
    description: 'Pack used to fill the results grid',
    downloads: 1000 - index,
    status: 'NodeStatusActive',
    publisher: { id: 'sizing-publisher', name: 'Sizing Publisher' },
    latest_version: { version: '1.0.0', status: 'NodeVersionStatusActive' },
    repository: `https://github.com/test/sizing-pack-${index}`
  })
)

const SIZING_HITS: Partial<AlgoliaNodePack>[] = SIZING_PACKS.map(
  (pack, index) => ({
    objectID: pack.id,
    id: pack.id,
    name: pack.name,
    description: pack.description,
    total_install: pack.downloads,
    status: pack.status,
    publisher_id: 'sizing-publisher',
    latest_version: '1.0.0',
    latest_version_status: 'NodeVersionStatusActive',
    repository_url: pack.repository,
    comfy_nodes: [`SizingNode${index}`],
    create_time: '2024-01-01T00:00:00Z',
    update_time: '2024-06-01T00:00:00Z',
    license: 'MIT'
  })
)

function measureGridOverflow(panelElement: HTMLElement) {
  const panel = panelElement.getBoundingClientRect()
  // `overflow: hidden` clips at the padding box, inside the panel's border.
  const clipEdge =
    panel.left + panelElement.clientLeft + panelElement.clientWidth
  const overflowPx = (element: Element) =>
    Math.max(0, Math.round(element.getBoundingClientRect().right - clipEdge))
  const grid = panelElement.querySelector('#results-grid')
  const cards = Array.from(
    panelElement.querySelectorAll('[data-virtual-grid-item]')
  )

  return {
    gridOverflowPx: grid ? overflowPx(grid) : -1,
    clippedCards: cards.filter((card) => overflowPx(card) > 0).length
  }
}

test.describe('ManagerDialog', { tag: '@ui' }, () => {
  test.beforeEach(async ({ page }) => {
    const statsWithManager = {
      ...mockSystemStats,
      system: {
        ...mockSystemStats.system,
        argv: ['main.py', '--enable-manager']
      }
    }
    await page.route('**/system_stats**', async (route) => {
      await route.fulfill({ json: statsWithManager })
    })

    await page.route('**/v2/customnode/installed**', async (route) => {
      await route.fulfill({ json: MOCK_INSTALLED_PACKS })
    })

    await page.route('**/v2/manager/queue/status**', async (route) => {
      await route.fulfill({
        json: {
          total_count: 0,
          done_count: 0,
          in_progress_count: 0,
          pending_count: 0,
          is_processing: false
        } satisfies ManagerComponents['schemas']['QueueStatus']
      })
    })

    await page.route('**/v2/manager/queue/history**', async (route) => {
      await route.fulfill({ json: {} })
    })

    await page.route('**/*.algolia.net/**', async (route) => {
      await route.fulfill({ json: MOCK_ALGOLIA_RESPONSE })
    })

    await page.route('**/*.algolianet.com/**', async (route) => {
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

    await page.route('**/api.comfy.org/nodes/search**', async (route) => {
      await route.fulfill({ json: registryListResponse })
    })

    await page.route(
      (url) => url.hostname === 'api.comfy.org' && url.pathname === '/nodes',
      async (route) => {
        await route.fulfill({ json: registryListResponse })
      }
    )

    await page.route('https://api.comfy.org/bulk/nodes/versions', (route) =>
      route.fulfill({
        json: {
          node_versions: []
        } satisfies RegistryComponents['schemas']['BulkNodeVersionsResponse']
      })
    )
    await page.route(
      'https://api.comfy.org/nodes/test-pack-a/versions/1.0.0/comfy-nodes**',
      (route) =>
        route.fulfill({
          json: {
            comfy_nodes: [],
            totalNumberOfPages: 0
          } satisfies RegistryOperations['ListComfyNodes']['responses'][200]['content']['application/json']
        })
    )

    await page.route('**/v2/customnode/getmappings**', async (route) => {
      await route.fulfill({ json: {} })
    })

    await page.route('**/v2/customnode/import_fail_info**', async (route) => {
      await route.fulfill({ json: {} })
    })

    await new FeatureFlagHelper(page).seedServerFlags({
      extension: {
        manager: {
          supports_v4: true,
          supports_csrf_post: true
        }
      }
    })
  })

  async function openManagerDialog(comfyPage: ComfyPage) {
    await comfyPage.command.executeCommand('Comfy.OpenManagerDialog')
  }

  test.describe('Flagged version installation', () => {
    test.beforeEach(async ({ comfyPage }) => {
      let queued = false
      await comfyPage.page.route('**/v2/manager/queue/status**', (route) =>
        route.fulfill({
          json: {
            total_count: queued ? 1 : 0,
            done_count: 0,
            in_progress_count: 0,
            is_processing: queued
          } satisfies ManagerComponents['schemas']['QueueStatus']
        })
      )
      await comfyPage.page.route(
        '**/api.comfy.org/nodes/test-pack-b',
        (route) =>
          route.fulfill({
            json: MOCK_PACK_B
          })
      )
      await comfyPage.page.route(
        '**/api.comfy.org/nodes/test-pack-b/versions',
        (route) =>
          route.fulfill({
            json: [
              { version: '2.1.0', status: 'NodeVersionStatusFlagged' },
              { version: '2.0.0', status: 'NodeVersionStatusActive' }
            ] satisfies RegistryComponents['schemas']['NodeVersion'][]
          })
      )
      await comfyPage.page.route(
        '**/api.comfy.org/nodes/test-pack-b/versions/2.1.0/comfy-nodes**',
        (route) =>
          route.fulfill({
            json: {
              comfy_nodes: [],
              totalNumberOfPages: 0
            } satisfies RegistryOperations['ListComfyNodes']['responses'][200]['content']['application/json']
          })
      )
      await comfyPage.page.route('**/v2/manager/queue/task', (route) => {
        queued = true
        return route.fulfill({ status: 200, body: '' })
      })
      await comfyPage.page.route('**/v2/manager/queue/start', (route) =>
        route.fulfill({ status: 200, body: '' })
      )
    })

    test('restores Install and reports a refused Flagged version without offering Apply Changes', async ({
      comfyPage,
      getWebSocket
    }) => {
      await openManagerDialog(comfyPage)
      const manager = comfyPage.page.getByRole('dialog').filter({
        has: comfyPage.page.getByRole('heading', { name: 'Nodes Manager' })
      })
      await manager.getByText('Test Pack B', { exact: true }).click()
      const info = manager.getByRole('complementary')
      const versionBadge = info.getByRole('button', { name: /^2\.1\.0/ })
      await versionBadge.scrollIntoViewIfNeeded()
      await expect
        .poll(() =>
          manager.evaluate(
            (element) => element.getAnimations({ subtree: true }).length
          )
        )
        .toBe(0)
      await versionBadge.click()

      const versions = comfyPage.page.getByRole('dialog').filter({
        has: comfyPage.page.getByRole('listbox')
      })
      const latest = versions.getByRole('option', {
        name: 'Latest stable (2.0.0)',
        exact: true
      })
      const flagged = versions.getByRole('option', {
        name: 'Latest (2.1.0)',
        exact: true
      })
      await expect(latest).toHaveAttribute('aria-selected', 'true')
      await expect(latest.getByText('Flagged')).toHaveCount(0)
      await expect(flagged.getByText('Flagged')).toBeVisible()
      await flagged.click()

      const taskRequestPromise = comfyPage.page.waitForRequest(
        (request) =>
          request.url().endsWith('/v2/manager/queue/task') &&
          request.method() === 'POST'
      )
      const queueStartPromise = comfyPage.page.waitForRequest(
        (request) =>
          request.url().endsWith('/v2/manager/queue/start') &&
          request.method() === 'POST'
      )
      await versions
        .getByRole('button', { name: 'Install', exact: true })
        .click()
      const request = await taskRequestPromise
      const task: ManagerComponents['schemas']['QueueTaskItem'] =
        request.postDataJSON()
      expect(task).toMatchObject({
        kind: 'install',
        params: {
          id: 'test-pack-b',
          version: '2.1.0',
          selected_version: '2.1.0'
        }
      })
      await queueStartPromise
      await expect(
        info.getByRole('button', { name: 'Installing' })
      ).toBeDisabled()

      const socket = await getWebSocket()
      const result: ManagerComponents['schemas']['TaskHistoryItem'] = {
        ui_id: task.ui_id,
        client_id: task.client_id,
        kind: task.kind,
        timestamp: new Date().toISOString(),
        result:
          'This action is not allowed by the current security configuration. See the terminal for details.',
        status: { status_str: 'error', completed: true, messages: [] }
      }
      socket.send(
        JSON.stringify({
          type: 'cm-task-completed',
          data: {
            ...result,
            state: {
              history: { [task.ui_id]: result },
              running_queue: [],
              pending_queue: [],
              installed_packs: MOCK_INSTALLED_PACKS
            }
          } satisfies ManagerComponents['schemas']['MessageTaskDone']
        })
      )

      await expect(
        comfyPage.page.getByRole('alert').filter({ hasText: result.result })
      ).toBeVisible()
      await expect(
        comfyPage.page.getByText('Failed', { exact: true })
      ).toBeVisible()
      await expect(
        info.getByRole('button', { name: 'Install', exact: true })
      ).toBeEnabled()
      await expect(
        manager.getByRole('button', { name: 'Installing' })
      ).toHaveCount(0)
      await expect(
        comfyPage.page.getByRole('button', { name: 'Apply Changes' })
      ).toHaveCount(0)
      await expect(
        comfyPage.page.getByText('To apply changes, please restart ComfyUI')
      ).toHaveCount(0)
    })
  })

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

  test.describe('Grid sizing', () => {
    test.beforeEach(async ({ comfyPage }) => {
      const algoliaResponse: AlgoliaSearchResponse = {
        results: [
          {
            hits: SIZING_HITS,
            nbHits: SIZING_HITS.length,
            page: 0,
            nbPages: 1,
            hitsPerPage: 64
          }
        ]
      }
      for (const pattern of ['**/*.algolia.net/**', '**/*.algolianet.com/**']) {
        await comfyPage.page.route(pattern, (route) =>
          route.fulfill({ json: algoliaResponse })
        )
      }
      const registryResponse = {
        total: SIZING_PACKS.length,
        nodes: SIZING_PACKS,
        page: 1,
        limit: 64,
        totalPages: 1
      }
      await comfyPage.page.route('**/api.comfy.org/nodes/search**', (route) =>
        route.fulfill({ json: registryResponse })
      )
      await comfyPage.page.route(
        (url) => url.hostname === 'api.comfy.org' && url.pathname === '/nodes',
        (route) => route.fulfill({ json: registryResponse })
      )
    })

    const managerPanel = (comfyPage: ComfyPage): Locator =>
      comfyPage.page.getByRole('dialog').filter({
        has: comfyPage.page.getByRole('heading', { name: 'Nodes Manager' })
      })

    // 3440 is the reported regression; 2560 sits below the 3000px breakpoint
    // and guards the widths that already laid out correctly.
    for (const width of [2560, 3440]) {
      test(`Results grid stays inside the dialog panel at ${width}px`, async ({
        comfyPage
      }) => {
        await comfyPage.page.setViewportSize({ width, height: 1440 })
        await openManagerDialog(comfyPage)

        const panel = managerPanel(comfyPage)
        await expect(panel).toBeVisible()
        await expect(
          panel.getByText('Sizing Pack 0', { exact: true })
        ).toBeVisible()
        await expect
          .poll(() => panel.locator('[data-virtual-grid-item]').count())
          .toBeGreaterThan(14)
        // Cards have replaced the skeletons, so the only animation left to
        // outlast is the dialog's zoom-in, which skews getBoundingClientRect().
        await expect
          .poll(() =>
            panel.evaluate(
              (element) => element.getAnimations({ subtree: true }).length
            )
          )
          .toBe(0)

        await expect
          .poll(() => panel.evaluate(measureGridOverflow))
          .toEqual({ gridOverflowPx: 0, clippedCards: 0 })
      })
    }

    test('Dialog panel widens at the 3000px breakpoint', async ({
      comfyPage
    }) => {
      await openManagerDialog(comfyPage)

      const panel = managerPanel(comfyPage)
      await expect(panel).toBeVisible()

      const panelWidth = () =>
        panel.evaluate((element: HTMLElement) => element.offsetWidth)

      await comfyPage.page.setViewportSize({ width: 2999, height: 1440 })
      await comfyPage.page.waitForFunction(() => window.innerWidth === 2999)
      const widthBelowBreakpoint = await panelWidth()

      await comfyPage.page.setViewportSize({ width: 3000, height: 1440 })
      await comfyPage.page.waitForFunction(() => window.innerWidth === 3000)
      // Relational, not the exact 2200px: this pins that the step applies at
      // all, and retuning the cap is a design change, not a regression.
      await expect.poll(panelWidth).toBeGreaterThan(widthBelowBreakpoint)
    })
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
