import { expect } from '@playwright/test'

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

test(
  'keeps two distinct user message image previews after a browser refresh',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }, testInfo) => {
    const droppedFilename = 'ComfyUI_00002_.png'
    const secondFilename = 'ComfyUI_00003_.png'

    await page.route(
      `**/view?filename=${droppedFilename}&type=input`,
      (route) => route.fulfill({ path: assetPath('image64x64.webp') })
    )
    await page.route(`**/view?filename=${secondFilename}&type=input`, (route) =>
      route.fulfill({ path: assetPath('image32x32.webp') })
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
            attachments: request.attachments,
            attachment_refs: (request.attachments ?? []).map((name) => ({
              name,
              id: `asset-${name}`,
              kind: 'image'
            }))
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
      .getByRole('button', { name: enMessages.agent.entryButton, exact: true })
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
    await panel.dispatchEvent('drop', {
      dataTransfer: await page.evaluateHandle(
        ({ mime, filename }) => {
          const dataTransfer = new DataTransfer()
          dataTransfer.setData(
            mime,
            JSON.stringify({
              filename,
              subfolder: '',
              type: 'output',
              attachment_ref: filename,
              media_kind: 'image'
            })
          )
          return dataTransfer
        },
        { mime: MIME_ASSET_INFO, filename: droppedFilename }
      )
    })
    await panel.dispatchEvent('drop', {
      dataTransfer: await page.evaluateHandle(
        ({ mime, filename }) => {
          const dataTransfer = new DataTransfer()
          dataTransfer.setData(
            mime,
            JSON.stringify({
              filename,
              subfolder: '',
              type: 'output',
              attachment_ref: filename,
              media_kind: 'image'
            })
          )
          return dataTransfer
        },
        { mime: MIME_ASSET_INFO, filename: secondFilename }
      )
    })

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    await composer.pressSequentially('compare these images')
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    expect(promptHistory.requests[0].attachments).toEqual([
      droppedFilename,
      secondFilename
    ])

    await expect(panel.getByTestId('reply-image-preview')).toHaveCount(2)
    const image = panel.getByRole('img', { name: droppedFilename, exact: true })
    await expect(image).toBeVisible()
    await expect(image).toHaveJSProperty('naturalWidth', 64)
    const secondImage = panel.getByRole('img', {
      name: secondFilename,
      exact: true
    })
    await expect(secondImage).toBeVisible()
    await expect(secondImage).toHaveJSProperty('naturalWidth', 32)
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

    await expect(reopenedPanel.getByTestId('reply-image-preview')).toHaveCount(
      2,
      {
        timeout: 10_000
      }
    )
    await expect(
      reopenedPanel.getByRole('img', { name: droppedFilename, exact: true })
    ).toHaveJSProperty('naturalWidth', 64)
    await expect(
      reopenedPanel.getByRole('img', { name: secondFilename, exact: true })
    ).toHaveJSProperty('naturalWidth', 32)
    await expect(image).toBeVisible()
    await expect(secondImage).toBeVisible()
    await reopenedPanel.screenshot({
      path: testInfo.outputPath('after-reload.png')
    })
  }
)
