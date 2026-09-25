import { expect, mergeTests } from '@playwright/test'
import type {
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'
import { AGENT_CRDT_DOC_ID_SESSION_KEY } from '@/platform/workflow/persistence/base/storageKeyConstants'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { readPersistedAgentWorkflowTabPath } from '@/workbench/extensions/agent/stores/agent/agentWorkflowTabBindingStorage'
import {
  agentTest,
  bootAgentApp,
  getAgentActiveWorkflowPath,
  pushAgentEvent,
  readPersistedAgentDocIdentity,
  switchToAgentWorkflowTab
} from '@e2e/fixtures/agentPanelFixture'
import { parseClientDocFrame } from '@e2e/fixtures/agentFollowerHostSocket'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { CommandHelper } from '@e2e/fixtures/helpers/CommandHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

test.describe('Agent CRDT reload', { tag: '@cloud' }, () => {
  test.use({
    connectWebSocketToServer: false,
    captureWebSocketMessages: true
  })

  test.beforeEach(async ({ page }) => {
    const workflows: WorkflowListResponse = {
      data: [],
      pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
    }
    const threads: AgentThreadListResponse = {
      threads: [],
      pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
    }

    await page.route('**/api/internal/cloud_analytics', (route) =>
      route.fulfill(jsonRoute({}))
    )
    const folders: ModelFolderInfo[] = []
    await page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute(folders))
    )
    await page.route(/\/api\/workflows\?limit=100$/, (route) =>
      route.fulfill(jsonRoute(workflows))
    )
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(threads))
    )
  })

  test('FE-1969 restores the subscription after reload and suspends it in the background', async ({
    page,
    agentFlagEnabled,
    getWebSocket,
    nextWebSocket,
    webSocketMessages
  }) => {
    test.setTimeout(90_000)
    const workflowId = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'
    const agentPanel = new AgentPanel(page)
    const command = new CommandHelper(page)
    const matchesDocFrame =
      (type: 'doc_subscribe' | 'doc_unsubscribe') =>
      (message: string): boolean => {
        const frame = parseClientDocFrame(message)
        return frame?.type === type && frame.workflowId === workflowId
      }

    await bootAgentApp(page, agentFlagEnabled)

    const ws =
      await test.step('Bind the active workflow and request its subscription', async () => {
        const ws = await getWebSocket()
        await agentPanel.open()
        pushAgentEvent(ws, {
          type: 'agent_active_tab',
          data: { workflow_id: workflowId, name: 'Reload receipt' }
        })

        await expect
          .poll(() =>
            webSocketMessages.countFor(ws, matchesDocFrame('doc_subscribe'))
          )
          .toBe(1)
        return ws
      })

    ws.send(
      JSON.stringify({
        type: 'doc_subscribed',
        data: { v: 1, workflow_id: workflowId, ok: true, seq: 0 }
      })
    )

    await expect
      .poll(() =>
        page.evaluate(
          (key) => sessionStorage.getItem(key),
          AGENT_CRDT_DOC_ID_SESSION_KEY
        )
      )
      .not.toBeNull()
    const recordBeforeReload = await readPersistedAgentDocIdentity(page)
    expect(recordBeforeReload).toMatchObject({ docId: workflowId })

    const rawBindings = await page.evaluate(
      (key) => localStorage.getItem(key),
      StorageKeys.agentWorkflowTabBindings('personal')
    )
    const boundPath = readPersistedAgentWorkflowTabPath(rawBindings, workflowId)
    if (!boundPath) throw new Error('Persisted workflow tab binding is missing')
    await expect.poll(() => getAgentActiveWorkflowPath(page)).toBe(boundPath)
    expect(
      await page.evaluate(() => localStorage.getItem('Comfy.Agent.ThreadId'))
    ).toBeNull()

    // Count across every socket EXCEPT the pre-reload one. The claim under test
    // is "the reloaded app resubscribed", not "one particular WebSocketRoute
    // saw it", and a reload can route more than one replacement socket. Binding
    // the assertion to a single captured route turns a product failure and a
    // test-plumbing failure into the same red, which is what made the earlier
    // run ambiguous.
    const countAfterReload = (
      type: 'doc_subscribe' | 'doc_unsubscribe'
    ): number => webSocketMessages.count(matchesDocFrame(type), ws)
    const firstSocketWithFrameAfterReload = (
      type: 'doc_subscribe' | 'doc_unsubscribe'
    ) => webSocketMessages.firstSocket(matchesDocFrame(type), ws)

    await test.step('Reload and restore the workflow subscription', async () => {
      // Arm the waiter BEFORE the reload. The replacement socket is routed
      // and starts recording as soon as the reloaded page connects, so a
      // waiter registered afterwards can miss it and leave the assertion
      // below polling a socket that never receives the resubscribe.
      const pendingWs = nextWebSocket()
      await page.reload()
      await waitForCloudApp(page)
      // Not `agentPanel.open()`: the panel restores itself on reload, so this
      // is a readiness wait on the same page object's root, not a second open.
      await expect(agentPanel.root).toBeVisible()
      const reloadedWs = await pendingWs
      reloadedWs.send(
        JSON.stringify({
          type: 'status',
          data: { status: { exec_info: { queue_remaining: 0 } } }
        })
      )
      // Assert the restore in stages so a red says WHERE it broke. The doc-id
      // record and the rebound tab are the two preconditions for resubscribing;
      // if either is wrong the subscribe assertion below is a downstream
      // symptom, and if both hold then the gap is in the follower bind itself.
      const record = await readPersistedAgentDocIdentity(page)
      expect(record).toMatchObject({ docId: workflowId })
      expect(record.nonce).not.toBe(recordBeforeReload.nonce)
      await expect.poll(() => getAgentActiveWorkflowPath(page)).toBe(boundPath)

      await expect.poll(() => countAfterReload('doc_subscribe')).toBe(1)

      const subscribedSocket = firstSocketWithFrameAfterReload('doc_subscribe')
      if (!subscribedSocket)
        throw new Error('Reloaded workflow subscription socket is missing')
      subscribedSocket.send(
        JSON.stringify({
          type: 'doc_subscribed',
          data: { v: 1, workflow_id: workflowId, ok: true, seq: 0 }
        })
      )
    })

    await test.step('Switching away unsubscribes and returning requests a subscription', async () => {
      expect(countAfterReload('doc_unsubscribe')).toBe(0)
      await command.executeCommand('Comfy.NewBlankWorkflow')
      await expect.poll(() => countAfterReload('doc_unsubscribe')).toBe(1)
      const subscribeCountBeforeReturn = countAfterReload('doc_subscribe')

      await switchToAgentWorkflowTab(page, boundPath)
      await expect
        .poll(() => countAfterReload('doc_subscribe'))
        .toBe(subscribeCountBeforeReturn + 1)
    })
  })
})
