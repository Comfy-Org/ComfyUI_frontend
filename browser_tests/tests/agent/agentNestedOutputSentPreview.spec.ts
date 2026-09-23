import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { AssetsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import {
  MULTI_OUTPUT_FIRST,
  MULTI_OUTPUT_JOB_ID,
  MULTI_OUTPUT_SECOND
} from '@e2e/fixtures/data/assetFixtures'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.use({ connectWebSocketToServer: false })

// The last unverified link in the PM-1157/PM-1158 chain: what the SENT message
// requests for a dragged NON-IMAGE output.
//
// #18197 proved the drag source is correct (a nested row attaches its own
// output), and #18104 repaired `UserMessage`'s `splitAttachments` to prefer
// `item.previewUrl`. But `startAssetDrag` publishes `preview_url` only for
// `mediaKind === 'image'`, so a video drags none, and the fallback rebuilds
// `/view?filename=<ref>&type=input` from `attachment_ref`. For a nested output
// that ref is the display filename, because `outputAssetUtil` deliberately
// does not copy the jobs-endpoint hash onto nested items.
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

// REPRODUCES A LIVE DEFECT. Measured on main at `00b02cbea3`: the sent
// message's video source is `/api/view?filename=out_one.mp4&type=input`, the
// display-name lookup, instead of the dragged asset's own
// `/api/assets/<id>/content`. That URL resolves only when the display name
// happens to equal the storage name, which is the PM-1157/PM-1158 symptom.
//
// Left failing rather than fixed here: the candidates are to publish a
// `preview_url` for non-image kinds (which ADR-ASSETS-DRAG-DROP-0035 rule 2
// deliberately scopes to image previews) or to resolve a staged attachment
// through its asset id at send time. Both change product behaviour on a
// surface with open owner PRs (#16985, #17767), so this ships as the repro
// and the decision stays with the PM-1157/PM-1158 owners. Remove `.fail()`
// with the fix.
test.fail(
  'sends a nested video output by its display name, not its asset id',
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

    await page
      .getByRole('button', { name: enMessages.agent.entryButton })
      .click()
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
