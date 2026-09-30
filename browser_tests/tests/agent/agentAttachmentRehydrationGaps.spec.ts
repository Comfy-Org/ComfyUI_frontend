import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import {
  BARE_DIGEST,
  dropLibraryAsset,
  openAgentPanel,
  PLAIN_FILENAME,
  reopenAfterReload,
  resolvedImageRefs,
  sendTurn,
  serveHistory,
  THREAD_KEY
} from '@e2e/fixtures/helpers/agentAttachmentRehydration'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'

/**
 * PM-1643 / PM-717 item 3, end to end: the attachment shapes a user turn comes
 * back in that agentAttachmentHistoryPersistence.spec.ts cannot reach. That
 * spec attaches two ordinary `*.png` names, so its previews survive on the
 * extension alone; these cases cover the rows where the stored name cannot
 * carry the file — a library asset attached under its bare content hash, a
 * blank name the API let through, a persisted display name, and a turn that
 * was mid-flight when the user left the thread (PM-1149).
 *
 * Each case drives the real composer and a real reload, and stands in for one
 * thing only: the history GET the reload hydrates from. The agent service
 * returns a message row's `content` verbatim (getMessages,
 * services/agent/server/agent_handler.go), so replacing that response is the
 * whole difference between these rows and the shared fixture's, whose POST
 * mock records no attachments at all.
 */
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
    await reopened.screenshot({
      path: testInfo.outputPath('extensionless-ref-after-reload.png')
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
    // The writer stores `attachments` verbatim and has never filtered it, so a
    // blank posted by any client reaches the row this reload reads.
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

/**
 * PM-1705, pinning the CLIENT half of a repair whose server half is not
 * written yet: `attachmentRefsForRow` currently emits `{name, id?, kind?}`, so
 * the `display_name` mocked here is a shape no shipped server returns. It
 * fixes the contract the panel will read, so the label lands the moment the
 * service records it; until then a hash-named library asset still shows its
 * digest after a reload.
 */
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
 * The away-from-the-tab half: leaving the thread mid-turn stashes it, and
 * coming back hydrates the rows the service already holds for it. `StartTurn`
 * writes the user row and the streaming assistant row under a fresh server
 * `turn_id` while the ack hands the client the assistant ROW's id as the live
 * turn id (services/agent/server/agent_handler.go,
 * internal/persist/turnstart.go), so the two ids below are deliberately
 * distinct — a mock that reuses one id for both, as the shared fixture does,
 * cannot reproduce the turn coming back twice.
 */
test(
  'resumes a thread left mid-turn once, with its attachment',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    const serverTurnId = 'e2e-server-turn'
    const otherThreadId = 'e2e-other-thread'
    // The id the shared fixture's POST mock acks the first turn with. Held
    // here rather than read back, because the assistant row has to carry it
    // before any request asks for it.
    const liveTurnId = '1dda6c2a-fdc5-45c3-b499-000000000001'
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
      if (threadId === otherThreadId || !posted)
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
    await sendTurn(panel, 'upscale this')
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    await expect(panel.getByTestId('reply-image-preview')).toHaveCount(1)
    attachmentThreadId =
      (await page.evaluate((key) => localStorage.getItem(key), THREAD_KEY)) ??
      ''
    expect(attachmentThreadId).not.toBe('')

    const openHistory = () =>
      panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()

    await openHistory()
    await panel.getByRole('button', { name: 'Other thread' }).click()
    await expect(panel.getByTestId('user-message-bubble')).toHaveCount(0)

    await openHistory()
    await panel.getByRole('button', { name: 'Attachment thread' }).click()

    await expect(panel.getByTestId('reply-image-preview')).toHaveCount(1)
    await expect(panel.getByTestId('user-message-bubble')).toHaveCount(1)
    await expect(panel.getByTestId('user-message-bubble')).toContainText(
      'upscale this'
    )
    // Unlike a refresh, a thread switch never left the session, so the name the
    // user attached is still in hand and outlives the storage ref the row
    // names the file by.
    await expect(
      panel.getByRole('img', { name: 'Beach photo.png', exact: true })
    ).toBeVisible()
  }
)
