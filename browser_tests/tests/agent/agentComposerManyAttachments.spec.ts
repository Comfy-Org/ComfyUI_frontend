import { expect } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// Regression for https://linear.app/comfyorg/issue/PM-1954
//
// `composer-asset-section` grew without bound inside a panel that is a
// fixed-height `overflow-hidden` column, so attaching dozens of images drove
// the composer taller than the panel and left the action row — and the Send
// button on it — clipped below the panel's bottom edge with nothing scrollable
// to reach it. Enter was then the only way to send, so both halves of the
// report ("can't find Send" and "Enter won't send") are asserted together.
const ATTACHMENT_COUNT = 36

function pngAttachments(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `attachment-${String(index + 1).padStart(2, '0')}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from('image')
  }))
}

test.describe(
  'Agent composer with many attachments',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test.use({ viewport: { width: 700, height: 600 } })

    test('keeps Send reachable and submits with Enter after uploads settle', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      const page = comfyPage.page
      await page.route('**/api/upload/image', (route) =>
        route.fulfill(
          jsonRoute({ name: 'uploaded.png', subfolder: '', type: 'input' })
        )
      )

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('Use these images')

      await agentPanel.fileInput.setInputFiles(pngAttachments(ATTACHMENT_COUNT))
      await expect(agentPanel.attachmentChips).toHaveCount(ATTACHMENT_COUNT)

      // Enabled proves the uploads settled; in viewport proves the action row
      // survived the chips rather than being clipped past the panel.
      await expect(agentPanel.sendButton).toBeEnabled()
      await expect(agentPanel.sendButton).toBeInViewport({ ratio: 1 })

      // Capping the chips' height only helps if the user can still reach the
      // ones it pushes out of sight, which a wheel over the section proves and
      // an `overflow-hidden` cap would not.
      await agentPanel.composerAssetSection.hover()
      await page.mouse.wheel(0, 400)
      await expect
        .poll(() =>
          agentPanel.composerAssetSection.evaluate(
            (element) => element.scrollTop
          )
        )
        .toBeGreaterThan(0)

      await agentPanel.composer.press('Enter')

      await expect.poll(() => postedMessages).toHaveLength(1)
      const { content, attachments } = JSON.parse(postedMessages[0])
      expect(content).toContain('Use these images')
      // The backend consumes `attachments`, so capping the chips' height must
      // not drop the off-screen ones from either the text or that list.
      expect([
        ...content.matchAll(/@\[Image: (attachment-\d+\.png)\]/g)
      ]).toHaveLength(ATTACHMENT_COUNT)
      expect(attachments).toHaveLength(ATTACHMENT_COUNT)
    })
  }
)
