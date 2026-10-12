import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'

import { AssetsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import {
  MULTI_OUTPUT_FIRST,
  MULTI_OUTPUT_JOB_ID,
  MULTI_OUTPUT_SECOND
} from '@e2e/fixtures/data/assetFixtures'
import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.use({ connectWebSocketToServer: false })

// What the SENT message requests for a dragged nested video output (PM-1157/
// PM-1158). #18197 proved the drag source is correct: a nested row attaches
// its own output. This covers the send path: the sent message must keep the
// dragged video's media URL rather than rebuild
// `/view?filename=<ref>&type=input` from the display filename.
//
// This drives the REAL drag out of the panel rather than synthesizing a
// DataTransfer, which is what distinguishes it from
// `agentBatchOutputAttachment.spec.ts`.
const NESTED_VIDEO = {
  ...MULTI_OUTPUT_FIRST,
  name: 'out_one.mp4',
  mime_type: 'video/mp4'
}
const REPRESENTATIVE_VIDEO = {
  ...MULTI_OUTPUT_SECOND,
  name: 'out_two.mp4',
  mime_type: 'video/mp4'
}

test(
  'renders a nested video output from its media URL, not its display name',
  { tag: ['@cloud', '@agent'] },
  async ({ page, agentPanel, workflowSelection, promptHistory }) => {
    // The boot fixture already routed `/api/assets` to an empty list, so these
    // are registered afterwards on purpose: Playwright matches the most
    // recently registered route first.
    await page.route(/\/api\/assets(\?.*)?$/, async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assets: [NESTED_VIDEO, REPRESENTATIVE_VIDEO],
          total: 2,
          has_more: false
        })
      })
    )
    await page.route(
      new RegExp(`/api/jobs/${MULTI_OUTPUT_JOB_ID}/assets(\\?.*)?$`),
      async (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ assets: [], total: 0, has_more: false })
        })
    )

    const serveVideo = (route: Route) =>
      route.fulfill({
        path: assetPath('workflowInMedia/workflow.mp4'),
        contentType: 'video/mp4'
      })
    await page.route(/\/api\/assets\/[^/]+\/content(\?.*)?$/, serveVideo)
    await page.route(/\/api\/view\?.*/, serveVideo)

    const panel = await agentPanel.open()
    await agentPanel.chooseWorkflow()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    workflowSelection.finishSave(true)

    const assets = new AssetsSidebarTab(page)
    await assets.open()
    await assets.openSettingsMenu()
    await assets.listViewOption.click()
    await assets.closeSettingsMenu()
    await assets.expandOutputStack()

    const nestedRow = assets.listRowByName(NESTED_VIDEO.name)
    await expect(nestedRow).toBeVisible()
    await nestedRow.dragTo(panel)

    // `fill` would clear the ProseMirror doc and drop the attachment atom.
    await agentPanel.composer.pressSequentially('use this generation')
    await agentPanel.sendButton.click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    await expect(panel.getByTestId('reply-video-preview')).toHaveAttribute(
      'src',
      new RegExp(`/assets/${NESTED_VIDEO.id}/content`)
    )
  }
)
