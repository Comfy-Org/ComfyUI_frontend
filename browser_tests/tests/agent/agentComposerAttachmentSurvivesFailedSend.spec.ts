import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const ATTACHMENT = 'image32x32.webp'

test.describe(
  'Agent composer attachment preservation',
  { tag: '@cloud' },
  () => {
    // FE-1972 / #16513: a failed message POST must leave the prompt *and* the
    // attachment basket retryable.
    test('keeps an attached image sendable when the send fails, and retries it', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      const page = comfyPage.page
      const prompt = 'Describe this reference image'

      await page.route('**/api/upload/image', (route) =>
        route.fulfill(
          jsonRoute({
            name: ATTACHMENT,
            subfolder: '',
            type: 'input'
          } satisfies UploadImageResponse)
        )
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
      const preview = chip.getByRole('img', { name: ATTACHMENT })

      await test.step('compose a prompt carrying an uploaded image', async () => {
        // Text first: the attachment is an inline reference in the same
        // contenteditable, so filling afterwards would overwrite the chip.
        await agentPanel.composer.fill(prompt)
        await agentPanel.fileInput.setInputFiles(assetPath(ATTACHMENT))
        await expect(chip).toHaveCount(1)
        await expect(agentPanel.sendButton).toBeEnabled()
      })

      await test.step('fail the send', async () => {
        await agentPanel.sendButton.click()
        await expect(
          agentPanel.root.getByText(enMessages.agent.sendFailed)
        ).toBeVisible()
      })

      await test.step('the prompt and the attachment are both still there', async () => {
        await expect(agentPanel.composer).toContainText(prompt)
        await expect(chip).toHaveCount(1)
        await expect(agentPanel.sendButton).toBeEnabled()
      })

      await test.step('the restored preview still resolves', async () => {
        // A preview whose URL died still renders a sized box, so presence is
        // not the discriminator: decoding it is.
        await expect(preview).toBeVisible()
        await preview.evaluate((image: HTMLImageElement) => image.decode())
        await expect(preview).toHaveJSProperty('naturalWidth', 32)
      })

      await test.step('the retry posts the same attachment and clears the composer', async () => {
        await agentPanel.sendButton.click()
        await expect.poll(() => postedMessages.length).toBe(1)
        expect(
          zAgentPostMessageRequest.parse(JSON.parse(postedMessages[0]))
        ).toMatchObject({ attachments: [ATTACHMENT] })
        await expect(chip).toHaveCount(0)
        await expect(agentPanel.composer).not.toContainText(prompt)
      })
    })
  }
)
