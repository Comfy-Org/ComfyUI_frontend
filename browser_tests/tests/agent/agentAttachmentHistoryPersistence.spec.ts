import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type { AgentMessage } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'

// PM-1148 / PM-1409 / PM-717: an attached asset preview on a USER message
// used to disappear after a browser refresh, while the same preview inside
// the agent's own reply survived (it is literal markdown in the persisted
// final text). The real backend returns the resolved attachment on reload --
// getMessages (services/agent/server/agent_handler.go) serializes the
// AgentMessage row's `content` field verbatim, and that content carries
// `attachment_refs: [{name, id, kind}]` once a turn is posted with
// attachments (services/agent/internal/persist/threads.go's
// contentAttachments; database/schema/agent_message.go's `content` JSON
// column stores it). normalizeAgentTranscript
// (src/workbench/extensions/agent/services/agent/agentTranscript.ts) now
// reads `content.attachments`/`content.attachment_refs` when rebuilding a
// user turn, so agentConversationStore.hydrate() restores the same
// `attachments` the live send path recorded. This test mimics the real
// API's verbatim content pass-through (agentPromptHistoryFixture's own POST
// mock does not carry attachments yet) and asserts the preview still
// renders post-reload.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

const firstImage = { filename: 'ComfyUI_00002_.png', width: 64, visible: true }
const secondImage = { filename: 'ComfyUI_00003_.png', width: 32, visible: true }
const references = [
  { name: firstImage.filename, id: 'asset-first', kind: 'image' },
  { name: secondImage.filename, id: 'asset-second', kind: 'image' }
]

async function dropImages(page: Page, panel: Locator, filenames: string[]) {
  for (const filename of filenames) {
    const dataTransfer = await page.evaluateHandle(
      ({ mime, filename }) => {
        const transfer = new DataTransfer()
        transfer.setData(
          mime,
          JSON.stringify({
            filename,
            subfolder: '',
            type: 'output',
            attachment_ref: filename,
            media_kind: 'image'
          })
        )
        return transfer
      },
      { mime: MIME_ASSET_INFO, filename }
    )
    await panel.dispatchEvent('drop', { dataTransfer })
    await dataTransfer.dispose()
  }
}

async function expectImages(panel: Locator, images: (typeof firstImage)[]) {
  await expect(panel.getByTestId('reply-image-preview')).toHaveCount(
    images.length
  )
  await expect
    .poll(() =>
      panel
        .getByRole('img', { name: /^ComfyUI_0000[23]_\.png$/ })
        .evaluateAll((elements) =>
          elements.map((image) => ({
            filename: image.getAttribute('alt'),
            width: image instanceof HTMLImageElement ? image.naturalWidth : 0,
            visible: image.checkVisibility()
          }))
        )
    )
    .toEqual(images)
}

for (const scenario of [
  {
    name: 'one image from filenames',
    images: [firstImage],
    historyContent: { attachments: [firstImage.filename] }
  },
  {
    name: 'two distinct images from filenames and references',
    images: [firstImage, secondImage],
    historyContent: {
      attachments: [firstImage.filename, secondImage.filename],
      attachment_refs: references
    }
  },
  {
    name: 'two distinct images from references only',
    images: [firstImage, secondImage],
    historyContent: { attachment_refs: references }
  }
]) {
  test(
    `keeps ${scenario.name} after a browser refresh`,
    { tag: ['@cloud', '@ui'] },
    async ({ page, promptHistory, workflowSelection }, testInfo) => {
      const filenames = scenario.images.map((image) => image.filename)

      await page.route(
        `**/view?filename=${firstImage.filename}&type=input`,
        (route) => route.fulfill({ path: assetPath('image64x64.webp') })
      )
      await page.route(
        `**/view?filename=${secondImage.filename}&type=input`,
        (route) => route.fulfill({ path: assetPath('image32x32.webp') })
      )

      // The real ingest API returns the message row's `content` map verbatim,
      // including `attachment_refs` once a turn's attachments resolve
      // server-side (services/agent/server/agent_handler.go's getMessages sets
      // messageResponse.Content = m.Content directly). Stand in for that GET
      // response here since the shared prompt-history fixture's own mock does
      // not yet carry attachments through to `content` at all. POST still goes
      // through the fixture's handler unmodified (route.fallback()).
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        const request = promptHistory.requests.at(0)
        if (!request) return route.fallback()
        const threadId = new URL(route.request().url()).pathname
          .split('/')
          .at(-2)!
        const turnId = 'e2e-attachment-turn'
        const messages: AgentMessage[] = [
          {
            id: 'e2e-attachment-user',
            thread_id: threadId,
            turn_id: turnId,
            seq: 1,
            role: 'user',
            status: 'complete',
            workflow_id: request.workflow_id,
            content: {
              text: request.content,
              ...scenario.historyContent
            }
          },
          {
            id: turnId,
            thread_id: threadId,
            turn_id: turnId,
            seq: 2,
            role: 'assistant',
            status: 'complete',
            content: { text: 'Looks good.' }
          }
        ]
        return route.fulfill(jsonRoute(messages))
      })

      await page
        .getByRole('button', {
          name: enMessages.agent.entryButton,
          exact: true
        })
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

      // Simulate dropping a generated asset card into the composer, the same
      // way agentBatchOutputAttachment.spec.ts does: the real drag source puts
      // this shape on the DataTransfer.
      await dropImages(page, panel, filenames)

      const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
      await composer.pressSequentially('compare these images')
      await panel
        .getByRole('button', { name: enMessages.agent.send, exact: true })
        .click()
      await expect.poll(() => promptHistory.requests.length).toBe(1)
      expect(promptHistory.requests[0].attachments).toEqual(filenames)

      await expectImages(panel, scenario.images)
      await panel.screenshot({ path: testInfo.outputPath('before-reload.png') })

      // Settle the (WS-less) turn so the reload below is not racing a
      // permanently-streaming assistant message.
      await panel
        .getByRole('button', { name: enMessages.agent.stop, exact: true })
        .click()

      await page.reload()
      await expect(
        page.getByTestId('integrated-tab-bar-actions')
      ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 30_000 })
      const reopenedPanel = page.locator('#agent-panel-root')
      await expect(reopenedPanel).toBeVisible({ timeout: 30_000 })

      await expectImages(reopenedPanel, scenario.images)
      await reopenedPanel.screenshot({
        path: testInfo.outputPath('after-reload.png')
      })
    }
  )
}
