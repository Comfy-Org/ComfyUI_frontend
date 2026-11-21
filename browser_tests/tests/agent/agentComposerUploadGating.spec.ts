import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent composer while attachments upload',
  { tag: '@cloud' },
  () => {
    let attachmentCount = 0
    let releaseUploads = () => {}
    let uploadsSettled = Promise.resolve()
    let holdUpload: (route: Route) => Promise<void> = async () => {}

    test.beforeEach(async ({ page }) => {
      attachmentCount = 5
      let uploadsFulfilled = 0
      let allUploadsFulfilled = () => {}
      const uploadsHeld = new Promise<void>((resolve) => {
        releaseUploads = resolve
      })
      uploadsSettled = new Promise<void>((resolve) => {
        allUploadsFulfilled = resolve
      })
      holdUpload = async (route: Route) => {
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
        if (++uploadsFulfilled === attachmentCount) allUploadsFulfilled()
      }
      await page.route('**/api/upload/image', holdUpload)
    })

    test.afterEach(async ({ page }) => {
      releaseUploads()
      await page.unroute('**/api/upload/image', holdUpload)
    })

    test('explains blocked Send and submits only resolved attachments', async ({
      agentPanel,
      postedMessages
    }) => {
      const uploadStatus = agentPanel.root.getByTestId('composer-upload-status')
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('Use these images')
      await expect(agentPanel.sendButton).toBeEnabled()

      await agentPanel.fileInput.setInputFiles(
        Array.from({ length: attachmentCount }, (_, index) => ({
          name: `attachment-${index + 1}.png`,
          mimeType: 'image/png',
          buffer: Buffer.from('image')
        }))
      )
      await expect(agentPanel.attachmentChips).toHaveCount(attachmentCount)
      await expect(agentPanel.sendButton).toBeDisabled()
      await expect(uploadStatus).toHaveText(
        `Uploading ${attachmentCount} attachments`
      )

      await agentPanel.composer.press('Enter')
      await expect(agentPanel.composer).toHaveText('Use these images')
      await expect(agentPanel.attachmentChips).toHaveCount(attachmentCount)
      expect(postedMessages).toHaveLength(0)

      releaseUploads()
      await uploadsSettled

      await expect(uploadStatus).toHaveText('')
      await expect(agentPanel.sendButton).toBeEnabled()
      await expect(agentPanel.attachmentChips).toHaveCount(attachmentCount)
      expect(postedMessages).toHaveLength(0)

      await agentPanel.composer.press('End')
      await agentPanel.composer.pressSequentially(' now')
      await expect(agentPanel.composer).toHaveText('Use these images now')
      await agentPanel.composer.press('Enter')

      await expect.poll(() => postedMessages.length).toBe(1)
      const sent = zAgentPostMessageRequest.parse(JSON.parse(postedMessages[0]))
      expect(sent.content).toBe('Use these images now')
      expect(sent.attachments).toEqual(
        Array.from(
          { length: attachmentCount },
          (_, index) => `uploaded-${index + 1}.png`
        )
      )
    })
  }
)
