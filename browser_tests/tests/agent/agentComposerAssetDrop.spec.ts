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

  // A filename is user data and may contain a quote or a backslash, which would
  // break the attribute selector the chip is matched by. Exercised end to end
  // rather than unit-tested, so a regression in the escaping shows up as the
  // locator failing to find a chip that is plainly on screen.
  test.describe('a filename that is hostile to the selector', () => {
    // The quote and backslash are what actually break the quoted CSS string:
    // remove their escaping and this case fails. The \u0007 is carried too
    // because a filename may contain one, but measured honestly it does NOT
    // guard the escape's control-character branch - Chromium accepts a raw
    // control character inside a quoted attribute selector, so this case still
    // passes with that branch disabled. The branch stays for CSS-string
    // conformance, not because a test proves it.
    const AWKWARD_NAME = 'a "quoted" \\ name\u0007.mp4'
    const AWKWARD_ASSET = { ...AGENT_VIDEO_ASSET, name: AWKWARD_NAME }

    test.beforeEach(async ({ page, agentFlagEnabled }) => {
      await bootAgentApp(page, agentFlagEnabled, {
        assets: { assets: [AWKWARD_ASSET], total: 1, has_more: false }
      })
    })

    test('is still matched by the chip locator', async ({ page }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      const assets = new AssetsSidebarTab(page)
      await assets.open()
      await assets.assetCards.first().dragTo(agentPanel.root)

      await expect(agentPanel.attachmentChip(AWKWARD_NAME)).toBeVisible()
    })
  })
})
