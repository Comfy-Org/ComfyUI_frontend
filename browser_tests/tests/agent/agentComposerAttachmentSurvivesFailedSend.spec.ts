import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const ATTACHMENT = 'image32x32.webp'

/**
 * The upload echoes the filename it was given, so the chip's label, the
 * attachment `ref` the turn posts, and the `/view` preview all key off one
 * name. A response that renamed the file would still exercise the restore, but
 * it splits the assertions across two names for no extra coverage.
 */
const UPLOADED: UploadImageResponse = {
  name: ATTACHMENT,
  subfolder: '',
  type: 'input'
}

test.describe(
  'Agent composer attachment preservation',
  { tag: '@cloud' },
  () => {
    /**
     * FE-1972 / #16513: a failed message POST must leave the prompt *and* the
     * attachment basket intact for a retry. The text half of this is already
     * covered ("keeps a failed prompt available to retry", agentPanel.spec.ts);
     * nothing asserted that the attachment came back, which is the half the
     * ticket's acceptance criteria call out separately.
     *
     * The retry is part of the assertion on purpose. A chip that is merely
     * visible proves the reference was restored, not that it is still sendable:
     * the `ref` has to survive too, and its preview must not have been revoked
     * out from under the chip while the submission snapshot was released.
     */
    test('keeps an attached image sendable when the send fails, and retries it', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      const page = comfyPage.page
      const prompt = 'Describe this reference image'

      await page.route('**/api/upload/image', (route) =>
        route.fulfill(jsonRoute(UPLOADED))
      )
      await page.route(`**/view?filename=${ATTACHMENT}&type=input`, (route) =>
        route.fulfill({ path: assetPath(ATTACHMENT) })
      )

      // Only the first POST fails; the retry falls through to the fixture,
      // which accepts it and records its body in `postedMessages`. Scoped to
      // POST so the fixture still serves the thread's message history on GET.
      let failNextSend = true
      await page.route('**/api/agent/threads/*/messages', async (route) => {
        if (route.request().method() !== 'POST' || !failNextSend)
          return route.fallback()
        failNextSend = false
        await route.fulfill({
          status: 500,
          body: 'Agent temporarily unavailable'
        })
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const chip = agentPanel.attachmentChip(ATTACHMENT)
      const preview = chip.locator('img')

      await test.step('compose a prompt carrying an uploaded image', async () => {
        // Text first: the attachment is an inline reference in the same
        // contenteditable, so filling afterwards would overwrite the chip.
        await agentPanel.composer.fill(prompt)
        await agentPanel.fileInput.setInputFiles(assetPath(ATTACHMENT))
        await expect(chip).toHaveCount(1)
        // Upload settled — the chip drops its spinner and Send re-enables.
        await expect(agentPanel.sendButton).toBeEnabled()
      })

      await test.step('fail the send', async () => {
        await agentPanel.sendButton.click()
        await expect(
          agentPanel.root.getByText(enMessages.agent.sendFailed)
        ).toBeVisible()
        expect(postedMessages).toHaveLength(0)
      })

      await test.step('the prompt and the attachment are both still there', async () => {
        await expect(agentPanel.composer).toContainText(prompt)
        await expect(chip).toHaveCount(1)
        await expect(agentPanel.sendButton).toBeEnabled()
      })

      await test.step('the restored preview still resolves', async () => {
        // A revoked or orphaned preview URL leaves a broken chip: the element
        // is present either way, so decoding it is what tells them apart.
        await expect(preview).toBeVisible()
        await preview.evaluate((image: HTMLImageElement) => image.decode())
        expect(
          await preview.evaluate(
            (image: HTMLImageElement) => image.naturalWidth
          )
        ).toBe(32)
      })

      await test.step('the retry posts the same attachment and clears the composer', async () => {
        await agentPanel.sendButton.click()
        await expect.poll(() => postedMessages.length).toBe(1)
        expect(JSON.parse(postedMessages[0])).toMatchObject({
          attachments: [ATTACHMENT]
        })
        await expect(chip).toHaveCount(0)
        await expect(agentPanel.composer).not.toContainText(prompt)
      })
    })
  }
)
