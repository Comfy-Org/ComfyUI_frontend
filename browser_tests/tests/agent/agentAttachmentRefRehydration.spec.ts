import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'
import { zAgentTurnAccepted } from '@comfyorg/ingest-types/zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import {
  BARE_DIGEST,
  dropLibraryAsset,
  openAgentPanel,
  PLAIN_FILENAME,
  reopenAfterReload,
  resolvedImageRefs,
  sendTurn,
  serveHistory
} from '@e2e/fixtures/helpers/agentAttachmentRehydration'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'

const THREAD_KEY = StorageKeys.agentThread('personal')

/** PM-1643 / PM-717 item 3: persisted attachment presentation after reload. */
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test(
  'previews a refreshed attachment whose only surviving name is an extensionless ref',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }, testInfo) => {
    await page.route(`**/view?filename=${BARE_DIGEST}&type=input`, (route) =>
      route.fulfill({ path: assetPath('image64x64.webp') })
    )
    await serveHistory(page, promptHistory.requests, resolvedImageRefs)

    const panel = await openAgentPanel(page, workflowSelection)
    await dropLibraryAsset(page, panel, {
      displayName: 'Beach photo.png',
      ref: BARE_DIGEST,
      kind: 'image'
    })
    await sendTurn(panel, 'upscale this')
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    expect(promptHistory.requests[0].attachments).toEqual([BARE_DIGEST])
    await expect(panel.getByTestId('reply-image-preview')).toHaveCount(1)
    // The live label proves the drag/drop name is shown before persistence is
    // involved; the PM-1705 case below covers the rehydrated contract.
    await expect(
      panel.getByRole('img', { name: 'Beach photo.png', exact: true })
    ).toBeVisible()

    const reopened = await reopenAfterReload(panel, page)

    const preview = reopened.getByTestId('reply-image-preview')
    await expect(preview).toHaveCount(1, { timeout: 10_000 })
    await expect(preview).toHaveJSProperty('naturalWidth', 64)
    // figcaption is the compact grey tile the grid falls back to, and nothing
    // else in the panel renders one.
    await expect(reopened.locator('figcaption')).toHaveCount(0)
    await testInfo.attach('extensionless-ref-after-reload.png', {
      body: await reopened.screenshot(),
      contentType: 'image/png'
    })
  }
)

test(
  'drops a blank attachment name the API let through onto a refreshed turn',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    await page.route(`**/view?filename=${PLAIN_FILENAME}&type=input`, (route) =>
      route.fulfill({ path: assetPath('image64x64.webp') })
    )
    // The persisted row contains a blank attachment name.
    await serveHistory(page, promptHistory.requests, (posted) => ({
      text: posted.content,
      attachments: ['', ...(posted.attachments ?? [])]
    }))

    const panel = await openAgentPanel(page, workflowSelection)
    await dropLibraryAsset(page, panel, {
      displayName: PLAIN_FILENAME,
      ref: PLAIN_FILENAME,
      kind: 'image'
    })
    await sendTurn(panel, 'describe this')
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    const reopened = await reopenAfterReload(panel, page)

    await expect(reopened.getByTestId('reply-image-preview')).toHaveCount(1, {
      timeout: 10_000
    })
    await expect(reopened.locator('figcaption')).toHaveCount(0)
  }
)

/** PM-1705 / cloud #10854: expected display name beside its storage ref. */
test(
  'labels a refreshed attachment with the filename the user attached',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    await page.route(`**/view?filename=${BARE_DIGEST}&type=input`, (route) =>
      route.fulfill({ path: assetPath('image64x64.webp') })
    )
    await serveHistory(page, promptHistory.requests, (posted) => ({
      ...resolvedImageRefs(posted),
      attachment_refs: [
        {
          name: BARE_DIGEST,
          display_name: 'Beach photo.png',
          id: 'asset-rehydrated',
          kind: 'image'
        }
      ]
    }))

    const panel = await openAgentPanel(page, workflowSelection)
    await dropLibraryAsset(page, panel, {
      displayName: 'Beach photo.png',
      ref: BARE_DIGEST,
      kind: 'image'
    })
    await sendTurn(panel, 'upscale this')
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    const reopened = await reopenAfterReload(panel, page)

    await expect(
      reopened.getByRole('img', { name: 'Beach photo.png', exact: true })
    ).toBeVisible({ timeout: 10_000 })
  }
)

/**
 * PM-1149 with PM-1776's settled liveness decision: switching away while a
 * turn is streaming must not duplicate its user row or lose its attachment,
 * and returning must still present the server-owned turn as live.
 */
test(
  'resumes a thread left mid-turn once, with its attachment',
  { tag: ['@cloud', '@agent', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    const serverTurnId = 'e2e-server-turn'
    const otherThreadId = 'e2e-other-thread'
    let liveTurnId = ''
    let attachmentThreadId = ''

    await page.route(`**/view?filename=${BARE_DIGEST}&type=input`, (route) =>
      route.fulfill({ path: assetPath('image64x64.webp') })
    )
    await page.route('**/api/agent/threads', (route) => {
      const listed = [
        { id: attachmentThreadId, title: 'Attachment thread' },
        { id: otherThreadId, title: 'Other thread' }
      ].filter((thread) => thread.id !== '')
      const threads: AgentThreadListResponse = {
        threads: listed.map(({ id, title }) => ({
          id,
          title,
          preview: '',
          workflow_id: '',
          status: 'active',
          message_count: 0,
          created_at: '2026-09-11T10:00:00Z',
          updated_at: '2026-09-11T10:00:00Z',
          last_message_at: '2026-09-11T10:00:00Z'
        })),
        pagination: {
          offset: 0,
          limit: 100,
          total: listed.length,
          has_more: false
        }
      }
      return route.fulfill(jsonRoute(threads))
    })
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const threadId = new URL(route.request().url()).pathname
        .split('/')
        .at(-2)!
      const posted = promptHistory.requests.at(0)
      if (threadId !== attachmentThreadId || !posted)
        return route.fulfill(jsonRoute([]))
      const messages: AgentMessage[] = [
        {
          id: 'e2e-server-user-row',
          thread_id: threadId,
          turn_id: serverTurnId,
          seq: 1,
          role: 'user',
          status: 'complete',
          content: resolvedImageRefs(posted)
        },
        {
          id: liveTurnId,
          thread_id: threadId,
          turn_id: serverTurnId,
          seq: 2,
          role: 'assistant',
          status: 'streaming',
          content: {}
        }
      ]
      return route.fulfill(jsonRoute(messages))
    })

    const panel = await openAgentPanel(page, workflowSelection)
    await dropLibraryAsset(page, panel, {
      displayName: 'Beach photo.png',
      ref: BARE_DIGEST,
      kind: 'image'
    })
    const turnAccepted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/agent\/threads\/[^/]+\/messages$/.test(
          new URL(response.url()).pathname
        )
    )
    await sendTurn(panel, 'upscale this')
    const accepted = zAgentTurnAccepted.parse(await (await turnAccepted).json())
    liveTurnId = accepted.message_id
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    await expect(panel.getByTestId('reply-image-preview')).toHaveCount(1)
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), THREAD_KEY))
      .not.toBeNull()
    const storedThreadId = await page.evaluate(
      (key) => localStorage.getItem(key),
      THREAD_KEY
    )
    if (storedThreadId === null)
      throw new Error('Expected the accepted turn to persist its thread ID')
    expect(storedThreadId).toBe(accepted.thread_id)
    attachmentThreadId = storedThreadId

    const openHistory = () =>
      panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()

    await openHistory()
    await panel
      .getByRole('button', { name: 'Other thread', exact: true })
      .click()
    await expect(
      panel.getByRole('button', { name: enMessages.agent.send, exact: true })
    ).toBeVisible()

    await openHistory()
    await panel
      .getByRole('button', { name: 'Attachment thread', exact: true })
      .click()

    await expect(panel.getByTestId('reply-image-preview')).toHaveCount(1)
    await expect(panel.getByTestId('user-message-bubble')).toHaveCount(1)
    await expect(panel.getByTestId('user-message-bubble')).toContainText(
      'upscale this'
    )
    const attachment = panel.getByRole('img', {
      name: 'Beach photo.png',
      exact: true
    })
    await expect(attachment).toBeVisible()
    await expect(attachment).toHaveJSProperty('naturalWidth', 64)
    await expect(
      panel.getByRole('button', { name: enMessages.agent.stop, exact: true })
    ).toBeVisible()
    await expect(
      panel.getByRole('button', { name: enMessages.agent.send, exact: true })
    ).toHaveCount(0)
  }
)
