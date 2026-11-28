import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import {
  agentTest as test,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'

const WORKFLOW_ID = 'b71c0f84-3a5e-4d21-9f08-5c7b2e1a4d33'
const THREAD_ID = 'd48e2b17-6c90-4a3f-8e51-2f9c7b0a6e14'
const MESSAGE_ID = '1f6c3a92-7b48-4e05-9c2d-3a8b5e7f1002'
const EMPTY_DOCUMENT_VECTOR = 'AA=='

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}
const SEED: WorkflowJSON = { nodes: [], links: [] }

test.describe(
  'Agent panel closed and reopened',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('keeps the agent connection the panel was only hiding', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
      const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)

      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(emptyAgentThreadList()))
      )
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({
              thread_id: THREAD_ID,
              message_id: MESSAGE_ID,
              workflow_id: WORKFLOW_ID
            })
          })
        }
        return route.fulfill(jsonRoute([]))
      })
      await hostSocket.install()

      await bootAgentApp(page, true, {
        settings: { 'Comfy.Graph.CanvasInfo': false }
      })

      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open(30_000)

      await mockWorkflowPersistence(page, WORKFLOW_ID)

      await test.step('bind the workflow and run a turn so a follower session exists', async () => {
        await expect.poll(() => hostSocket.connectionCount()).toBe(1)

        await agentPanel.sendMessage('Add a note to the canvas.')
        await expect(
          panel.getByText('Add a note to the canvas.').first()
        ).toBeVisible()

        hostSocket.send({
          type: 'agent_active_tab',
          data: {
            workflow_id: WORKFLOW_ID,
            name: 'Unsaved Workflow',
            thread_id: THREAD_ID,
            message_id: MESSAGE_ID
          }
        })
        await expect.poll(() => hostSocket.subscribeCount()).toBe(1)
      })

      await test.step('close the panel', async () => {
        await agentPanel.close()
      })

      await test.step('reopen it and find the agent still usable', async () => {
        await agentPanel.open(30_000)
        await expect(panel).toBeVisible()
        await expect(
          panel.getByRole('textbox', { name: AGENT_COMPOSER_LABEL })
        ).toBeEditable()
      })

      await test.step('the connection was never dropped and redialled', async () => {
        await expect.poll(() => hostSocket.connectionCount()).toBe(1)
        expect(hostSocket.refusedConnectionCount()).toBe(0)
      })

      await test.step('the resubscribe resumes the surviving replica, not an empty one', async () => {
        await expect
          .poll(
            () =>
              hostSocket
                .clientDocFrames()
                .filter((frame) => frame.type === 'doc_subscribe').length
          )
          .toBe(2)
        const subscribes = hostSocket
          .clientDocFrames()
          .filter((frame) => frame.type === 'doc_subscribe')
        expect(subscribes[0].stateVector).not.toBeNull()
        expect(subscribes[1].stateVector).not.toBeNull()
        expect(
          subscribes[1].stateVector,
          'the reopened panel asked for a delta, not a whole-document cold seed'
        ).not.toBe(EMPTY_DOCUMENT_VECTOR)
        expect(subscribes[1].stateVector).not.toBe(subscribes[0].stateVector)
        expect(hostSocket.refusedSubscribeCount()).toBe(0)
      })
    })
  }
)
