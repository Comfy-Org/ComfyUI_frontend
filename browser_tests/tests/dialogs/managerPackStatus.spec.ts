import { expect } from '@playwright/test'

import type { AlgoliaNodePack } from '@/types/algoliaTypes'
import type { components as RegistryComponents } from '@comfyorg/registry-types'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'

type RegistryNodePack = RegistryComponents['schemas']['Node']
type RegistryNodeVersion = RegistryComponents['schemas']['NodeVersion']

/**
 * Black-box coverage for the flagged-vs-banned distinction.
 *
 * Flagged and banned mean different things -- flagged is "the scanner raised
 * findings and nobody has adjudicated them", banned is "a human reviewed this
 * and rejected it" -- and the UI used to render them identically: both red,
 * both labelled "Conflicting". Worse, a flagged version in the version
 * dropdown got the green verified checkmark, which asserts the opposite of
 * what is true.
 *
 * The unit and component tests pin the label/severity mapping. What only a
 * browser can answer is whether that mapping survives the trip through the
 * info panel and the version popover to something a user can actually see, so
 * these assert on rendered text and on which icon is present.
 *
 * Separate file rather than added to managerDialog.spec.ts: that file is being
 * edited concurrently by ComfyUI_frontend#18083 on the same feature.
 */

const FLAGGED_PACK_ID = 'flagged-pack'
const BANNED_PACK_ID = 'banned-pack'

const FLAGGED_PACK: RegistryNodePack = {
  id: FLAGGED_PACK_ID,
  name: 'Flagged Pack',
  description: 'A pack whose newest version tripped a scanner rule',
  downloads: 1200,
  status: 'NodeStatusActive',
  publisher: { id: 'flagged-publisher', name: 'Flagged Publisher' },
  latest_version: { version: '1.1.0', status: 'NodeVersionStatusFlagged' },
  repository: 'https://github.com/test/flagged-pack'
}

const BANNED_PACK: RegistryNodePack = {
  id: BANNED_PACK_ID,
  name: 'Banned Pack',
  description: 'A pack a reviewer rejected',
  downloads: 40,
  status: 'NodeStatusBanned',
  publisher: { id: 'banned-publisher', name: 'Banned Publisher' },
  latest_version: { version: '0.9.0', status: 'NodeVersionStatusBanned' },
  repository: 'https://github.com/test/banned-pack'
}

const FLAGGED_PACK_VERSIONS: RegistryNodeVersion[] = [
  { version: '1.0.0', status: 'NodeVersionStatusActive' },
  { version: '1.1.0', status: 'NodeVersionStatusFlagged' }
]

const MOCK_INSTALLED_PACKS = {
  [FLAGGED_PACK_ID]: {
    ver: '1.0.0',
    cnr_id: FLAGGED_PACK_ID,
    enabled: true,
    aux_id: null
  }
}

function algoliaHit(pack: RegistryNodePack): Partial<AlgoliaNodePack> {
  return {
    objectID: pack.id,
    id: pack.id,
    name: pack.name,
    description: pack.description,
    publisher_id: pack.publisher?.id,
    total_install: pack.downloads,
    latest_version: pack.latest_version?.version,
    status: pack.status,
    comfy_nodes: []
  }
}

const MOCK_ALGOLIA_RESPONSE = {
  results: [
    {
      hits: [algoliaHit(FLAGGED_PACK), algoliaHit(BANNED_PACK)],
      nbHits: 2,
      page: 0,
      nbPages: 1,
      hitsPerPage: 20
    }
  ]
}

test.describe('Manager pack status', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.route('**/system_stats**', async (route) => {
      await route.fulfill({
        json: {
          ...mockSystemStats,
          system: {
            ...mockSystemStats.system,
            argv: ['main.py', '--enable-manager']
          }
        }
      })
    })

    await comfyPage.page.route('**/v2/customnode/installed**', (route) =>
      route.fulfill({ json: MOCK_INSTALLED_PACKS })
    )
    await comfyPage.page.route('**/v2/manager/queue/status**', (route) =>
      route.fulfill({
        json: {
          history: {},
          running_queue: [],
          pending_queue: [],
          installed_packs: {}
        }
      })
    )
    await comfyPage.page.route('**/v2/manager/queue/history**', (route) =>
      route.fulfill({ json: {} })
    )
    await comfyPage.page.route('**/v2/customnode/getmappings**', (route) =>
      route.fulfill({ json: {} })
    )
    await comfyPage.page.route('**/v2/customnode/import_fail_info**', (route) =>
      route.fulfill({ json: {} })
    )

    await comfyPage.page.route('**/*.algolia.net/**', (route) =>
      route.fulfill({ json: MOCK_ALGOLIA_RESPONSE })
    )
    await comfyPage.page.route('**/*.algolianet.com/**', (route) =>
      route.fulfill({ json: MOCK_ALGOLIA_RESPONSE })
    )

    const registryListResponse = {
      total: 2,
      nodes: [FLAGGED_PACK, BANNED_PACK],
      page: 1,
      limit: 64,
      totalPages: 1
    }
    await comfyPage.page.route('**/api.comfy.org/nodes/search**', (route) =>
      route.fulfill({ json: registryListResponse })
    )
    await comfyPage.page.route(
      (url) => url.hostname === 'api.comfy.org' && url.pathname === '/nodes',
      (route) => route.fulfill({ json: registryListResponse })
    )
    await comfyPage.page.route(
      `**/api.comfy.org/nodes/${FLAGGED_PACK_ID}`,
      (route) => route.fulfill({ json: FLAGGED_PACK })
    )
    await comfyPage.page.route(
      `**/api.comfy.org/nodes/${BANNED_PACK_ID}`,
      (route) => route.fulfill({ json: BANNED_PACK })
    )
    await comfyPage.page.route(
      `**/api.comfy.org/nodes/${FLAGGED_PACK_ID}/versions**`,
      (route) => route.fulfill({ json: FLAGGED_PACK_VERSIONS })
    )
    await comfyPage.page.route('**/bulk/nodes/versions**', (route) =>
      route.fulfill({ json: { node_versions: [] } })
    )

    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- mirrors managerDialog.spec.ts, tracked by evfail-23
    await comfyPage.setup()

    // Seed manager feature flags AFTER setup so the WebSocket feature_flags
    // payload cannot overwrite them. See managerDialog.spec.ts for the
    // canonical pattern.
    await comfyPage.page.evaluate(() => {
      const api = window.app!.api
      api.serverFeatureFlags.value = {
        ...api.serverFeatureFlags.value,
        extension: {
          manager: { supports_v4: true, supports_csrf_post: true }
        }
      }
    })
  })

  async function openInfoPanel(comfyPage: ComfyPage, packName: string) {
    await comfyPage.command.executeCommand('Comfy.OpenManagerDialog')
    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByText(packName).first().click()
    return dialog
  }

  test('a banned pack says "Banned", not "Conflicting"', async ({
    comfyPage
  }) => {
    const dialog = await openInfoPanel(comfyPage, 'Banned Pack')

    // The bug: a banned pack showed the generic compatibility label and never
    // rendered the word "Banned" anywhere, so the one state that IS an
    // adjudicated decision was the one the user could not read.
    await expect(dialog.getByText('Banned', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Conflicting', { exact: true })).toHaveCount(
      0
    )
  })

  test('a flagged version is not shown as verified in the version list', async ({
    comfyPage
  }) => {
    const dialog = await openInfoPanel(comfyPage, 'Flagged Pack')

    await dialog.getByRole('button').filter({ hasText: '1.0.0' }).click()

    const popover = comfyPage.page.getByRole('listbox')
    await expect(popover).toBeVisible()

    const flaggedOption = popover.getByRole('option').filter({
      hasText: '1.1.0'
    })
    await expect(flaggedOption).toBeVisible()

    // The green verified checkmark on a flagged version asserts the opposite
    // of what is true: it says a human cleared this, when what happened is
    // that a scanner raised findings and nobody has looked. Assert the absence
    // of the check as well as the presence of the warning -- rendering both
    // would still mislead.
    await expect(
      flaggedOption.locator('.icon-\\[lucide--triangle-alert\\]')
    ).toBeVisible()
    await expect(flaggedOption.locator('svg')).toHaveCount(0)

    // The active version is the control: if the verified icon disappeared for
    // every version, the assertion above would pass while saying nothing.
    const activeOption = popover.getByRole('option').filter({
      hasText: '1.0.0'
    })
    await expect(activeOption.locator('svg')).toHaveCount(1)
  })
})
