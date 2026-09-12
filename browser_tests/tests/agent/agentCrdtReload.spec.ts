import type { Page, WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { countDocFrames, webSocketFixture } from '@e2e/fixtures/ws'
import type { WorkspaceStore } from '@e2e/types/globals'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

async function activeWorkflowPath(page: Page) {
  return await page.evaluate(
    () =>
      (window.app!.extensionManager as WorkspaceStore).workflow.activeWorkflow
        ?.path
  )
}

test.describe('Agent CRDT reload', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('FE-1969 restores the subscription after reload and suspends it in the background', async ({
    page,
    agentFlagEnabled,
    getWebSocket,
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
    const ws = await getWebSocket()
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(page.locator('#agent-panel-root')).toBeVisible()
    pushEvent(ws, {
      type: 'agent_active_tab',
      data: { workflow_id: workflowId, name: 'Reload receipt' }
    })

    await expect
      .poll(() =>
        countDocFrames(webSocketMessages, 'doc_subscribe', workflowId)
      )
      .toBe(1)
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
    await expect.poll(() => activeWorkflowPath(page)).toBe(boundPath)
    expect(
      await page.evaluate(() => localStorage.getItem('Comfy.Agent.ThreadId'))
    ).toBeNull()

    await page.reload()
    await waitForCloudApp(page)
    await expect(page.locator('#agent-panel-root')).toBeVisible()
    await expect
      .poll(() =>
        countDocFrames(webSocketMessages, 'doc_subscribe', workflowId)
      )
      .toBe(2)

    const recordAfterReload = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('Comfy.Agent.CrdtDocId')!)
    )
    expect(recordAfterReload).toMatchObject({ docId: workflowId })
    expect(recordAfterReload.nonce).not.toBe(recordBeforeReload.nonce)
    await expect.poll(() => activeWorkflowPath(page)).toBe(boundPath)

    await page.evaluate(() =>
      window.app!.extensionManager.command.execute('Comfy.NewBlankWorkflow')
    )
    await expect
      .poll(() =>
        countDocFrames(webSocketMessages, 'doc_unsubscribe', workflowId)
      )
      .toBe(1)
  })
})
