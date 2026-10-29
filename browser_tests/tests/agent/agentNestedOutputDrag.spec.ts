import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { AssetsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import {
  MULTI_OUTPUT_FIRST,
  MULTI_OUTPUT_JOB_ID,
  MULTI_OUTPUT_SECOND
} from '@e2e/fixtures/data/assetFixtures'
import { expect } from '@playwright/test'

// PM-1157/PM-1158: a reporter dragged one generation out of a multi-output job
// and got a broken chat attachment, while a top-level drag worked. The drag
// SOURCE half of that has never been exercised in a browser - the existing
// `agentBatchOutputAttachment.spec.ts` synthesizes its `DataTransfer`, so it
// cannot tell whether a nested row publishes its own output or the card's
// representative. The panel hides nested outputs behind "See more outputs",
// which is why this needs the stack-expansion support added alongside it.
//
// `unflattenOutputAssets` makes the LAST previewable asset the card's
// representative, so the collapsed card is `out_two.png` and expanding reveals
// `out_one.png`. Attaching `out_two.png` after dragging the `out_one.png` row
// is exactly the reported wrong-attachment shape.
test.describe(
  'Nested job output dragged to the composer',
  { tag: '@cloud' },
  () => {
    test.beforeEach(async ({ page, agentFlagEnabled }) => {
      // Expanding a stack resolves its children through the job's assets
      // endpoint on cloud. An empty list leaves the locally-mapped outputs
      // unenriched, which is enough to render them and keeps this spec about
      // drag identity rather than enrichment.
      await page.route(
        new RegExp(`/api/jobs/${MULTI_OUTPUT_JOB_ID}/assets(\\?.*)?$`),
        async (route) =>
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ assets: [], total: 0, has_more: false })
          })
      )

      await bootAgentApp(page, agentFlagEnabled, {
        assets: {
          assets: [MULTI_OUTPUT_FIRST, MULTI_OUTPUT_SECOND],
          total: 2,
          has_more: false
        }
      })
    })

    test('attaches the nested output that was dragged, not the card representative', async ({
      page
    }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      const assets = new AssetsSidebarTab(page)
      await assets.open()
      await assets.openSettingsMenu()
      await assets.listViewOption.click()
      await assets.closeSettingsMenu()

      // Collapsed, the job is one row showing its representative.
      await expect(assets.listRowByName(MULTI_OUTPUT_SECOND.name)).toBeVisible()
      await expect(assets.listRowByName(MULTI_OUTPUT_FIRST.name)).toHaveCount(0)

      await assets.expandOutputStack()

      const nestedRow = assets.listRowByName(MULTI_OUTPUT_FIRST.name)
      await expect(nestedRow).toBeVisible()

      await nestedRow.dragTo(agentPanel.root)

      // The dragged output, and only it: attaching the representative instead is
      // the PM-1157/PM-1158 failure, and a bare count assertion would pass.
      await expect(
        agentPanel.attachmentChip(MULTI_OUTPUT_FIRST.name)
      ).toBeVisible()
      await expect(
        agentPanel.attachmentChip(MULTI_OUTPUT_SECOND.name)
      ).toHaveCount(0)
      await expect(agentPanel.attachmentChips).toHaveCount(1)
    })
  }
)
