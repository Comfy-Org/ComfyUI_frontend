import { expect } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { AssetsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import { AGENT_VIDEO_ASSET } from '@e2e/fixtures/data/assetFixtures'
import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'

// The composer's "drag in asset from asset panel" path had no browser coverage
// at all, in either view mode: the drag source was proved by asserting the
// CANVAS consumer of the same payload, which cannot catch a composer-side
// attach regression. PM-1401 (a list row that never started a drag) and
// PM-1157/PM-1158 (a drag that attaches the wrong preview) both live here.
//
// The drop side accepts a drop purely on `dataTransfer.types` containing
// `application/x-comfy-asset-info` (`AgentPanelRoot` `isAssetDrag`), so it is
// view-agnostic by construction; what these cases pin is that every view mode
// actually publishes that payload, and that the chip names the asset dragged.
const ASSET_NAME = AGENT_VIDEO_ASSET.name

test.describe('Agent composer asset drop', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ page, agentFlagEnabled }) => {
    // Only the file's own id serves the MP4; the job id gets the backend's
    // 404 body. Registered before boot so the seeded list route, which is
    // scoped to the list endpoint, does not shadow it.
    await page.route(
      new RegExp(`/api/assets/${AGENT_VIDEO_ASSET.id}/content(\\?.*)?$`),
      async (route) =>
        await route.fulfill({
          path: assetPath('workflowInMedia/workflow.mp4'),
          contentType: 'video/mp4'
        })
    )

    await bootAgentApp(page, agentFlagEnabled, {
      assets: { assets: [AGENT_VIDEO_ASSET], total: 1, has_more: false }
    })
  })

  for (const view of ['grid', 'list'] as const) {
    test(`attaches an asset dragged onto the composer from ${view} view`, async ({
      page
    }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      const assets = new AssetsSidebarTab(page)
      await assets.open()

      if (view === 'list') {
        await assets.openSettingsMenu()
        await assets.listViewOption.click()
      }

      const source =
        view === 'list'
          ? assets.listViewItems.first()
          : assets.assetCards.first()
      await expect(source).toBeVisible()
      await expect(agentPanel.attachmentChips).toHaveCount(0)

      await source.dragTo(agentPanel.root)

      // Named, not merely present: a drag that attaches the wrong asset is the
      // PM-1157/PM-1158 failure, and it would pass a bare count assertion.
      await expect(agentPanel.attachmentChip(ASSET_NAME)).toBeVisible()
      await expect(agentPanel.attachmentChips).toHaveCount(1)
    })
  }
})
