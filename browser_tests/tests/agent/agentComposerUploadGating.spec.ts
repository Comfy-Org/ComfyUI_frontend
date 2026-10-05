import { expect } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// Regression for https://linear.app/comfyorg/issue/PM-1954
//
// `canSend` is false while any attachment is still uploading, and
// `useAttachment` uploads at most three at a time, so attaching a batch blocks
// sending for a window that grows with the batch. `onEnter` calls
// `preventDefault()` before that check, so during the window Enter produced no
// send, no newline and no message — the composer just went dead, which is what
// the reporter hit after attaching dozens of images. Blocking the send is
// correct (the refs are not resolved yet); doing it without saying so is not.
const ATTACHMENT_COUNT = 5

function pngAttachments(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `attachment-${index + 1}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from('image')
  }))
}

test.describe(
  'Agent composer while attachments upload',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test('says why sending is blocked, and sends once uploads settle', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      const page = comfyPage.page
      let releaseUploads = () => {}
      const uploadsHeld = new Promise<void>((resolve) => {
        releaseUploads = resolve
      })
      await page.route('**/api/upload/image', async (route) => {
        await uploadsHeld
        await route.fulfill(
          jsonRoute({ name: 'uploaded.png', subfolder: '', type: 'input' })
        )
      })

      try {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await agentPanel.composer.fill('Use these images')
        await expect(agentPanel.sendButton).toBeEnabled()

        await agentPanel.fileInput.setInputFiles(
          pngAttachments(ATTACHMENT_COUNT)
        )
        await expect(agentPanel.attachmentChips).toHaveCount(ATTACHMENT_COUNT)
        await expect(agentPanel.sendButton).toBeDisabled()

        // The composer has to account for the dead Send, naming how many
        // uploads it is waiting on rather than leaving the user to guess.
        await expect(agentPanel.composerUploadStatus).toHaveText(
          `Uploading ${ATTACHMENT_COUNT} attachments`
        )

        // Enter stays a no-op by design while refs are unresolved; what changes
        // is that the reason is now on screen instead of nowhere.
        await agentPanel.composer.press('Enter')

        releaseUploads()

        // Empty, not absent: the live region stays mounted so the next batch's
        // first message lands in a region the screen reader already knows.
        await expect(agentPanel.composerUploadStatus).toHaveText('')
        await expect(agentPanel.sendButton).toBeEnabled()
        // Check only after the upload requests and reactive UI have settled, so
        // a POST leaked by the first Enter cannot still be in flight.
        expect(postedMessages).toHaveLength(0)

        await agentPanel.composer.press('Enter')
        await expect.poll(() => postedMessages).toHaveLength(1)
        // Asserting the refs, not just the count: a send that leaked past the
        // gate would carry the staged empty refs and still be three long.
        expect(JSON.parse(postedMessages[0]).attachments).toEqual(
          Array.from({ length: ATTACHMENT_COUNT }, () => 'uploaded.png')
        )
      } finally {
        releaseUploads()
        await page.unrouteAll({ behavior: 'wait' })
      }
    })
  }
)
