import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { AssetsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  MULTI_OUTPUT_FIRST,
  MULTI_OUTPUT_JOB_ID,
  MULTI_OUTPUT_SECOND
} from '@e2e/fixtures/data/assetFixtures'
import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.use({ connectWebSocketToServer: false })

// The last unverified link in the PM-1157/PM-1158 chain: what the SENT message
// requests for a dragged NON-IMAGE output.
//
// #18197 proved the drag source is correct (a nested row attaches its own
// output), and #18104 repaired `UserMessage`'s `splitAttachments` to prefer
// `item.previewUrl`. This covers the remaining non-image path: the drag must
// publish the asset's content URL rather than make the sent message rebuild
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
  'sends a nested video output by its asset id, not its display name',
  { tag: ['@cloud', '@agent'] },
  async ({ page, workflowSelection, promptHistory }) => {
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

    // Serve every asset content URL, and record which ones the page asks for.
    const contentRequests: string[] = []
    await page.route(/\/api\/assets\/[^/]+\/content(\?.*)?$/, async (route) => {
      contentRequests.push(new URL(route.request().url()).pathname)
      await route.fulfill({
        path: assetPath('workflowInMedia/workflow.mp4'),
        contentType: 'video/mp4'
      })
    })

    // The ref-based fallback lookup. Recorded rather than failed, so the test
    // reports which URL the product actually chose.
    const viewRequests: string[] = []
    await page.route(/\/api\/view\?.*/, async (route) => {
      viewRequests.push(route.request().url())
      await route.fulfill({
        path: assetPath('workflowInMedia/workflow.mp4'),
        contentType: 'video/mp4'
      })
    })

    await new AgentPanel(page).open()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()
    await panel
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .click()
    await page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
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

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    // `fill` would clear the ProseMirror doc and drop the attachment atom.
    await composer.pressSequentially('use this generation')
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    const video = panel.getByTestId('reply-video-preview')
    await expect(video).toBeVisible()

    // The dragged output is what the sent message must show. A nested output
    // has no hash, so a ref-based `/view?filename=<display name>&type=input`
    // only resolves when the display name happens to equal the storage name -
    // the PM-1157/PM-1158 shape. Assert the source identifies the dragged
    // asset by its own id instead.
    const src = await video.getAttribute('src')
    expect(
      src,
      `sent video src was ${src}; content requests: ${contentRequests.join(', ')}; ` +
        `ref-based /view requests: ${viewRequests.join(', ')}`
    ).toContain(`/assets/${NESTED_VIDEO.id}/content`)
  }
)
