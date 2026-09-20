import { expect, mergeTests } from '@playwright/test'

import {
  agentTest,
  bootAgentApp,
  getAgentActiveWorkflowPath,
  pushAgentEvent
} from '@e2e/fixtures/agentPanelFixture'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { countDocFrames, webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.entryButton

test.describe('Agent CRDT reload', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('FE-1969 restores the subscription after reload and suspends it in the background', async ({
    page,
    agentFlagEnabled,
    getWebSocket,
    nextWebSocket,
    webSocketMessages
  }) => {
    test.setTimeout(90_000)
    const workflowId = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'

    await page.route('**/api/internal/cloud_analytics', (route) =>
      route.fulfill(jsonRoute({}))
    )
    await page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await page.route(/\/api\/workflows\?limit=100$/, (route) =>
      route.fulfill(
        jsonRoute({
          data: [],
          pagination: { has_more: false, next_cursor: null }
        })
      )
    )
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute({ threads: [] }))
    )
    await bootAgentApp(page, agentFlagEnabled)

    const ws =
      await test.step('Bind the active workflow and persist its reload state', async () => {
        const ws = await getWebSocket()
        await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
        await expect(page.locator('#agent-panel-root')).toBeVisible()
        pushAgentEvent(ws, {
          type: 'agent_active_tab',
          data: { workflow_id: workflowId, name: 'Reload receipt' }
        })

        await expect
          .poll(() =>
            countDocFrames(webSocketMessages, ws, 'doc_subscribe', workflowId)
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
        page.evaluate(() => sessionStorage.getItem('Comfy.Agent.CrdtDocId'))
      )
      .not.toBeNull()
    const recordBeforeReload = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('Comfy.Agent.CrdtDocId')!)
    )
    expect(recordBeforeReload).toMatchObject({ docId: workflowId })

    const boundPath = await page.evaluate(
      ([key, id]) => {
        const bindings = JSON.parse(
          localStorage.getItem(key) ?? '{}'
        ) as Record<string, string>
        return bindings[id]
      },
      ['Comfy.Agent.WorkflowTabBindings', workflowId]
    )
    expect(boundPath).toBeTruthy()
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
    ): number => {
      let total = 0
      for (const socket of webSocketMessages.keys()) {
        if (socket === ws) continue
        total += countDocFrames(webSocketMessages, socket, type, workflowId)
      }
      return total
    }

    await test.step('Reload and restore the workflow subscription', async () => {
      // Arm the waiter BEFORE the reload. The replacement socket is routed
      // and starts recording as soon as the reloaded page connects, so a
      // waiter registered afterwards can miss it and leave the assertion
      // below polling a socket that never receives the resubscribe.
      const pendingWs = nextWebSocket()
      await page.reload()
      await waitForCloudApp(page)
      await expect(page.locator('#agent-panel-root')).toBeVisible()
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
      const record = await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('Comfy.Agent.CrdtDocId')!)
      )
      expect(record).toMatchObject({ docId: workflowId })
      expect(record.nonce).not.toBe(recordBeforeReload.nonce)
      await expect.poll(() => getAgentActiveWorkflowPath(page)).toBe(boundPath)

      await expect.poll(() => countAfterReload('doc_subscribe')).toBe(1)
    })

    await test.step('Opening a blank workflow suspends the restored follower', async () => {
      expect(countAfterReload('doc_unsubscribe')).toBe(0)
      await page.evaluate(() =>
        window.app!.extensionManager.command.execute('Comfy.NewBlankWorkflow')
      )
      await expect.poll(() => countAfterReload('doc_unsubscribe')).toBe(1)
    })
  })
})
