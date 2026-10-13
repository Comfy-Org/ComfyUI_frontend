import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// Regression: https://linear.app/comfyorg/issue/PM-1954
test.describe(
  'Agent composer while attachments upload',
  { tag: '@cloud' },
  () => {
    test('explains blocked Send and submits only resolved attachments', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      const page = comfyPage.page
      let releaseUploads = () => {}
      const uploadsHeld = new Promise<void>((resolve) => {
        releaseUploads = resolve
      })
      let uploadNumber = 0
      await page.route('**/api/upload/image', async (route) => {
        const currentUpload = ++uploadNumber
        await uploadsHeld
        const uploaded: UploadImageResponse = {
          name: `uploaded-${currentUpload}.png`,
          subfolder: '',
          type: 'input'
        }
        await route.fulfill(jsonRoute(uploaded))
      })

      try {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await agentPanel.composer.fill('Use these images')
        await expect(agentPanel.sendButton).toBeEnabled()

        await agentPanel.fileInput.setInputFiles(
          Array.from({ length: 5 }, (_, index) => ({
            name: `attachment-${index + 1}.png`,
            mimeType: 'image/png',
            buffer: Buffer.from('image')
          }))
        )
        await expect(agentPanel.attachmentChips).toHaveCount(5)
        await expect(agentPanel.sendButton).toBeDisabled()
        await expect(agentPanel.composerUploadStatus).toHaveText(
          'Uploading 5 attachments'
        )

        await agentPanel.composer.press('Enter')

        releaseUploads()

        await expect(agentPanel.composerUploadStatus).toHaveText('')
        await expect(agentPanel.sendButton).toBeEnabled()
        expect(postedMessages).toHaveLength(0)

        await agentPanel.composer.press('Enter')
        await expect.poll(() => postedMessages.length).toBe(1)
        expect(
          zAgentPostMessageRequest.parse(JSON.parse(postedMessages[0]))
            .attachments
        ).toEqual([
          'uploaded-1.png',
          'uploaded-2.png',
          'uploaded-3.png',
          'uploaded-4.png',
          'uploaded-5.png'
        ])
      } finally {
        releaseUploads()
        await page.unrouteAll({ behavior: 'wait' })
      }
    })
  }
)
