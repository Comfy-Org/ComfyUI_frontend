import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'

test.use({ connectWebSocketToServer: false })

// Dragging a non-first output of a multi-output/batch job (the "layers"
// stack expansion in the asset sidebar) into the agent chat composer shows
// the wrong image once the message is sent. The asset-drag payload for a
// non-primary output has no content hash — only a bare output filename in
// `ref` (see outputAssetUtil.ts's deliberate omission) plus a correct
// `previewUrl`. UserMessage.vue's splitAttachments discards `previewUrl`
// whenever `ref` is set and reconstructs `/view?filename=<ref>&type=input`,
// which does not resolve to the dragged output. Canvas drop and the
// primary/first output are unaffected, so this reproduces the
// composer-only, non-first-output-only bug.
test(
  'shows the dragged non-first batch output in the sent message, not a type=input lookup',
  { tag: ['@cloud', '@agent', '@ui'] },
  async ({ page, workflowSelection, promptHistory }) => {
    const droppedFilename = 'ComfyUI_00002_.png'
    const correctPreviewPath = '/assets/asset-e2e-batch-output-2/content'

    // The correct preview (what `previewUrl` already points at, captured from
    // the dragged card at drop time) vs. what `splitAttachments`' `ref`-based
    // reconstruction actually resolves to today. Two different fixture images
    // (32x32 vs 64x64) so a passing test can tell them apart by more than
    // just "an image loaded".
    await page.route(`**${correctPreviewPath}`, (route) =>
      route.fulfill({ path: assetPath('image32x32.webp') })
    )
    await page.route(
      `**/view?filename=${droppedFilename}&type=input`,
      (route) => route.fulfill({ path: assetPath('image64x64.webp') })
    )

    await page
      .getByRole('button', { name: enMessages.agent.entryButton })
      .click()
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
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

    const correctPreviewUrl = new URL(correctPreviewPath, page.url()).toString()

    // Simulate dropping a "layer 2" asset card: the real drag source
    // (MediaAssetCard.vue) puts this exact shape on the DataTransfer -
    // `attachment_ref` with no hash, a `preview_url`, and `media_kind: 'image'`.
    await panel.dispatchEvent('drop', {
      dataTransfer: await page.evaluateHandle(
        ({ mime, filename, previewUrl }) => {
          const dataTransfer = new DataTransfer()
          dataTransfer.setData(
            mime,
            JSON.stringify({
              filename,
              subfolder: '',
              type: 'output',
              attachment_ref: filename,
              media_kind: 'image',
              preview_url: previewUrl
            })
          )
          return dataTransfer
        },
        {
          mime: MIME_ASSET_INFO,
          filename: droppedFilename,
          previewUrl: correctPreviewUrl
        }
      )
    })

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    // `fill` clears the editor's whole ProseMirror doc before typing, which
    // deletes the atom node the drop above just inserted (see
    // agentInlineReferences.spec.ts for the same constraint) - use
    // `pressSequentially` to append text without dropping the attachment.
    await composer.pressSequentially('use this generation')
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    const bubble = panel.getByTestId('user-message-bubble')
    await expect(bubble).toContainText('use this generation')
    // The preview <img> sits inside a role="button" wrapper (for the
    // lightbox-open click target), and Chromium's accessibility tree treats a
    // button's content as presentational, so the image never surfaces as its
    // own accessible `img` node - getByRole('img', ...) matches zero elements
    // here even though the correct image is rendered. Find it by test id
    // instead, and check the accessible name (alt) directly.
    const image = panel.getByTestId('reply-image-preview')
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('alt', droppedFilename)

    // Lens 1 (DOM/attribute): the rendered attachment's `src` should be the
    // dragged asset's own preview URL, not a reconstructed one.
    await expect(image).toHaveAttribute('src', correctPreviewUrl)

    // Lens 2 (visual): the two fixture images differ in pixel dimensions, so
    // a screenshot and a decoded-size check both confirm the dragged (32x32)
    // image rendered, not the other (64x64) fixture.
    await image.evaluate((el: HTMLImageElement) => el.decode())
    const naturalWidth = await image.evaluate(
      (el: HTMLImageElement) => el.naturalWidth
    )
    await bubble
      .locator('..')
      .screenshot({ path: 'test-results/batch-output-attachment.png' })
    expect(naturalWidth).toBe(32)
  }
)
