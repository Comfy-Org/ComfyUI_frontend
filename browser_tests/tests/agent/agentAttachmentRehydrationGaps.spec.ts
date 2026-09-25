import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentPostMessageRequest,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import type { WorkflowSelection } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'

/**
 * PM-1643 / PM-717 item 3, end to end: the attachment shapes a user turn comes
 * back in that agentAttachmentHistoryPersistence.spec.ts cannot reach. That
 * spec attaches two ordinary `*.png` names, so its previews survive on the
 * extension alone; these cases cover the rows where the stored name cannot
 * carry the file — a library asset attached under its bare content hash, a
 * blank name the API let through, a name the wire has no slot for, and a turn
 * that was mid-flight when the user left the thread (PM-1149).
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

/**
 * Cloud keys a library upload as `hash + filepath.Ext(name)`, so a name with
 * no extension leaves a bare digest as the storage key — and after a refresh
 * that ref is the only name the turn still has.
 */
const BARE_DIGEST = 'a'.repeat(64)
/** Agent threads are keyed per workspace since FE-2405; 'personal' is the
 * workspace every agent spec boots into. */
const THREAD_KEY = StorageKeys.agentThread('personal')
const PLAIN_FILENAME = 'ComfyUI_00002_.png'

interface DroppedLibraryAsset {
  displayName: string
  ref: string
  kind: MediaKind
}

/**
 * A deliberate subset of what `startAssetDrag` puts on the DataTransfer
 * (assetDragUtil.ts): the keys `getDroppedAsset` reads, minus `preview_url`,
 * so the pre-refresh preview resolves through the mocked `/view` route rather
 * than a URL this arrange would also have to serve.
 */
async function dropLibraryAsset(
  page: Page,
  panel: Locator,
  asset: DroppedLibraryAsset
): Promise<void> {
  await panel.dispatchEvent('drop', {
    dataTransfer: await page.evaluateHandle(
      ({ mime, displayName, ref, kind }) => {
        const dataTransfer = new DataTransfer()
        dataTransfer.setData(
          mime,
          JSON.stringify({
            filename: displayName,
            display_name: displayName,
            subfolder: '',
            type: 'output',
            attachment_ref: ref,
            media_kind: kind
          })
        )
        return dataTransfer
      },
      { mime: MIME_ASSET_INFO, ...asset }
    )
  })
}

function resolvedImageRefs(
  posted: AgentPostMessageRequest
): Record<string, unknown> {
  return {
    text: posted.content,
    attachments: posted.attachments,
    attachment_refs: (posted.attachments ?? []).map((name) => ({
      name,
      id: 'asset-rehydrated',
      kind: 'image'
    }))
  }
}

/** Serves the reload's history GET; POST stays on the fixture's handler. */
async function serveHistory(
  page: Page,
  requests: AgentPostMessageRequest[],
  content: (posted: AgentPostMessageRequest) => Record<string, unknown>
): Promise<void> {
  await page.route('**/api/agent/threads/*/messages', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const posted = requests.at(0)
    if (!posted) return route.fallback()
    const threadId = new URL(route.request().url()).pathname.split('/').at(-2)!
    const turnId = 'e2e-rehydrated-turn'
    const messages: AgentMessage[] = [
      {
        id: 'e2e-rehydrated-user',
        thread_id: threadId,
        turn_id: turnId,
        seq: 1,
        role: 'user',
        status: 'complete',
        content: content(posted)
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
}

async function openAgentPanel(
  page: Page,
  workflowSelection: WorkflowSelection
): Promise<Locator> {
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
  return panel
}

async function sendTurn(panel: Locator, prompt: string): Promise<void> {
  await panel
    .getByRole('textbox', { name: /^Describe ideas/ })
    .pressSequentially(prompt)
  await panel
    .getByRole('button', { name: enMessages.agent.send, exact: true })
    .click()
}

/**
 * Settles the (WS-less) turn so the reload is not racing a permanently
 * streaming assistant message, then reloads and waits the panel back up.
 */
async function reopenAfterReload(panel: Locator, page: Page): Promise<Locator> {
  await panel
    .getByRole('button', { name: enMessages.agent.stop, exact: true })
    .click()
  await page.reload()
  await expect(page.getByTestId('integrated-tab-bar-actions')).toHaveAttribute(
    'data-agent-gate-settled',
    'true',
    { timeout: 30_000 }
  )
  const reopened = page.locator('#agent-panel-root')
  await expect(reopened).toBeVisible({ timeout: 30_000 })
  return reopened
}

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
    // The live label, asserted here rather than in the PM-1705 case below: an
    // expected-failure body gives a working assertion no regression cover.
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
 * PM-1705, tracked and deliberately still red. `AgentPostMessageRequest`
 * declares `attachments` as filenames and has no slot for the name the user
 * recognises (services/ingest/openapi.yaml), so the turn is posted knowing
 * only the storage ref and no reload can recover what was never sent.
 *
 * Widening that contract is out of reach here — it is a cloud change followed
 * by regenerating `packages/ingest-types`, whose openapi.yaml is not checked
 * in. The other repair is reachable: the read path can resolve the name from
 * the asset behind `attachment_refs[].id`, which `assetService.getAssetDetails`
 * already fetches, at the cost of a request per attachment on hydrate. That
 * one would retire this case rather than turn it green, since this arrange
 * routes no asset endpoint.
 *
 * Twin of the `(h-gap)` pin in useAgentSession.test.ts, kept here because only
 * the browser shows what the user is left looking at. The pre-reload half of
 * the claim lives in the unmarked case above, where a regression can still
 * turn it red.
 */
test(
  'labels a refreshed attachment with the filename the user attached',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    test.fail()
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
