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
 * real info panel to something a user can see, which is what this asserts.
 *
 * The version dropdown's flagged icon is deliberately NOT tested here. It
 * lives in a PrimeVue Popover that no other browser test drives, and it is
 * already covered where it holds better: PackVersionSelectorPopover.test.ts
 * covers conflict -> warning triangle and no-conflict -> verified icon,
 * useConflictDetection.test.ts covers flagged status -> flagged conflict, and
 * "hands the latest version its status" in the former joins the two.
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
    // Opening the info panel fetches the node list for the displayed version.
    // The suite fails any unmocked external request, so this has to cover both
    // packs rather than just the one a given test opens.
    await comfyPage.page.route(
      '**/api.comfy.org/nodes/*/versions/*/comfy-nodes**',
      (route) =>
        route.fulfill({ json: { comfy_nodes: [], totalNumberOfPages: 0 } })
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

  /**
   * Returns the info panel, not the whole dialog. The pack grid stays mounted
   * behind the panel and renders its own status badges and version buttons, so
   * a dialog-scoped locator matches the grid as well and either goes ambiguous
   * or asserts against the wrong pack.
   */
  async function openInfoPanel(comfyPage: ComfyPage, packName: string) {
    await comfyPage.command.executeCommand('Comfy.OpenManagerDialog')
    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByText(packName).first().click()

    const panel = comfyPage.page.getByRole('complementary')
    await expect(panel).toBeVisible()
    return panel
  }

  test('a banned pack says "Banned", not "Conflicting"', async ({
    comfyPage
  }) => {
    const panel = await openInfoPanel(comfyPage, 'Banned Pack')

    // The status badge renders with role=alert.
    // Targeting the badge itself rather than the panel's text matters: a banned
    // pack also trips compatibility detection, so the word "Conflicting" does
    // legitimately appear elsewhere in the panel. The claim under test is
    // narrower -- that the STATUS field reports the adjudicated decision, which
    // it previously never did, rendering the generic label instead.
    const statusBadge = panel.getByRole('alert')
    await expect(statusBadge).toHaveText(/Banned/)
    await expect(statusBadge).not.toHaveText(/Conflicting/)

    // Severity, not just wording: banned is an adjudicated rejection and has
    // to read as an error rather than the warning flagged gets. This is the
    // half a text assertion cannot see, and the half that made the two states
    // indistinguishable on screen.
    await expect(statusBadge).toHaveClass(/bg-destructive-background\/10/)
  })
})
