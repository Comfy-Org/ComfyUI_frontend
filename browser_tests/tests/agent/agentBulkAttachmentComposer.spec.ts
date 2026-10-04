import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const ATTACHMENT_COUNT = 36

// Regression: https://linear.app/comfyorg/issue/FE-3202
test.describe('Agent composer bulk attachments', { tag: '@cloud' }, () => {
  test('keeps a visible send path after attaching dozens of images', async ({
    agentPanel,
    comfyPage,
    postedMessages
  }) => {
    const page = comfyPage.page
    const uploaded: UploadImageResponse = {
      name: 'reference.png',
      subfolder: '',
      type: 'input'
    }
    await page.route('**/api/upload/image', (route) =>
      route.fulfill(jsonRoute(uploaded))
    )

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.composer.fill('Compare these references')
    await agentPanel.fileInput.setInputFiles(
      Array.from({ length: ATTACHMENT_COUNT }, (_, index) => ({
        name: `reference-${index + 1}.png`,
        mimeType: 'image/png',
        buffer: Buffer.from(`reference-${index + 1}`)
      }))
    )

    await expect(agentPanel.attachmentChips).toHaveCount(ATTACHMENT_COUNT)
    await expect(agentPanel.sendButton).toBeEnabled()
    await expect(agentPanel.sendButton).toBeInViewport()

    await agentPanel.composer.press('Enter')
    await expect.poll(() => postedMessages.length).toBe(1)
  })
})
