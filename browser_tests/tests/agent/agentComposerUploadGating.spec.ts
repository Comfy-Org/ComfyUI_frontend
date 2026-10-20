import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const ATTACHMENT_COUNT = 5

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
      const uploadStatus = agentPanel.root.getByTestId('composer-upload-status')
      let releaseUploads = () => {}
      const uploadsHeld = new Promise<void>((resolve) => {
        releaseUploads = resolve
      })
      let uploadsFulfilled = 0
      let allUploadsFulfilled = () => {}
      const uploadsSettled = new Promise<void>((resolve) => {
        allUploadsFulfilled = resolve
      })
      // Name each ref after the file it answers, so a ref attached to the
      // wrong attachment is caught regardless of upload arrival order.
      const holdUpload = async (route: Route) => {
        const filename = /filename="attachment-(\d+)\.png"/.exec(
          route.request().postDataBuffer()?.toString('latin1') ?? ''
        )?.[1]
        await uploadsHeld
        const uploaded: UploadImageResponse = {
          name: `uploaded-${filename ?? 'unknown'}.png`,
          subfolder: '',
          type: 'input'
        }
        await route.fulfill(jsonRoute(uploaded))
        if (++uploadsFulfilled === ATTACHMENT_COUNT) allUploadsFulfilled()
      }
      await page.route('**/api/upload/image', holdUpload)

      try {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await agentPanel.composer.fill('Use these images')
        await expect(agentPanel.sendButton).toBeEnabled()

        await agentPanel.fileInput.setInputFiles(
          Array.from({ length: ATTACHMENT_COUNT }, (_, index) => ({
            name: `attachment-${index + 1}.png`,
            mimeType: 'image/png',
            buffer: Buffer.from('image')
          }))
        )
        await expect(agentPanel.attachmentChips).toHaveCount(ATTACHMENT_COUNT)
        await expect(agentPanel.sendButton).toBeDisabled()
        await expect(uploadStatus).toHaveText(
          `Uploading ${ATTACHMENT_COUNT} attachments`
        )

        await agentPanel.composer.press('Enter')
        await expect(agentPanel.composer).toHaveText('Use these images')
        await expect(agentPanel.attachmentChips).toHaveCount(ATTACHMENT_COUNT)
        expect(postedMessages).toHaveLength(0)

        releaseUploads()
        await uploadsSettled

        await expect(uploadStatus).toHaveText('')
        await expect(agentPanel.sendButton).toBeEnabled()
        await expect(agentPanel.attachmentChips).toHaveCount(ATTACHMENT_COUNT)
        expect(postedMessages).toHaveLength(0)

        // Change the draft before sending, so a first Enter that was queued
        // until the uploads finished is distinguishable from this send.
        await agentPanel.composer.press('End')
        await agentPanel.composer.pressSequentially(' now')
        await expect(agentPanel.composer).toHaveText('Use these images now')
        await agentPanel.composer.press('Enter')

        await expect.poll(() => postedMessages.length).toBe(1)
        const sent = zAgentPostMessageRequest.parse(
          JSON.parse(postedMessages[0])
        )
        expect(sent.content).toBe('Use these images now')
        expect(sent.attachments).toEqual(
          Array.from(
            { length: ATTACHMENT_COUNT },
            (_, index) => `uploaded-${index + 1}.png`
          )
        )
      } finally {
        releaseUploads()
        await page.unroute('**/api/upload/image', holdUpload)
      }
    })
  }
)
