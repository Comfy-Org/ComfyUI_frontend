import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// Regression for https://linear.app/comfyorg/issue/PM-1954
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

      await agentPanel.fileInput.setInputFiles(
        Array.from({ length: 36 }, (_, index) => ({
          name: `attachment-${String(index + 1).padStart(2, '0')}.png`,
          mimeType: 'image/png',
          buffer: Buffer.from('image')
        }))
      )
      await expect(agentPanel.attachmentChips).toHaveCount(36)
      await expect(agentPanel.sendButton).toBeInViewport({ ratio: 1 })
      await expect(agentPanel.sendButton).toBeEnabled()

      await agentPanel.composer.press('Enter')

      await expect.poll(() => postedMessages).toHaveLength(1)
      expect(JSON.parse(postedMessages[0])).toMatchObject({
        content: 'Use these images'
      })
    })
  }
)
