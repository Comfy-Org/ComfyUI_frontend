import { expect } from '@playwright/test'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  AGENT_NODE_IDS,
  addLoadImageNode,
  catalog,
  emptySeed
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const WORKFLOW_ID = '720f3de6-b8a2-4ed2-833b-e5c55cb9e001'
const THREAD_ID = '720f3de6-b8a2-4ed2-833b-e5c55cb9e002'
const FIRST_MESSAGE_ID = '720f3de6-b8a2-4ed2-833b-e5c55cb9e003'
const SECOND_MESSAGE_ID = '720f3de6-b8a2-4ed2-833b-e5c55cb9e004'
const [FIRST_NODE_ID, SECOND_NODE_ID] = AGENT_NODE_IDS
const FIRST_STALE_VALUE = 'agent-1.png'
const SECOND_STALE_VALUE = 'agent-2.png'
const FIRST_FRESH_VALUE = 'caught-up-1.png'
const SECOND_FRESH_VALUE = 'caught-up-2.png'
const staleTitle = (value: string): string => `Load Image · ${value}`
const freshTitle = (value: string): string => `Updated Load Image · ${value}`

function widgetWrite(nodeId: number, value: string): RecordedGraphOperation {
  return { op: 'set_widget', node_id: nodeId, widget: 'image', value }
}

function titleWrite(nodeId: number, value: string): RecordedGraphOperation {
  return { op: 'set_node_field', node_id: nodeId, field: 'title', value }
}

function parsePost(body: string | null): AgentPostMessageRequest {
  const parsed: unknown = JSON.parse(body ?? '{}')
  return zAgentPostMessageRequest.parse(parsed)
}

function done(messageId: string): AgentWsEvent {
  return {
    type: 'agent_message_done',
    data: { thread_id: THREAD_ID, message_id: messageId, usage: null }
  }
}

test.describe(
  'Agent stale bound-canvas draft',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test(
      'keeps two missed Load Image edits after a question-only turn',
      {
        annotation: [
          {
            type: 'issue',
            description: 'https://linear.app/comfy/issue/PM-1890'
          },
          {
            type: 'issue',
            description: 'https://linear.app/comfy/issue/PM-2118'
          }
        ]
      },
      async ({ page, request }) => {
        test.setTimeout(60_000)
        const comfyPage = new ComfyPage(page, request)
        const host = new HostDoc(WORKFLOW_ID, emptySeed, catalog)
        const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)
        const panel = new AgentPanel(page)
        const posts: AgentPostMessageRequest[] = []
        let mayAnswerSubscribe = true

        hostSocket.answerSubscribesWith((stateVector) =>
          mayAnswerSubscribe
            ? [host.subscribed(), host.catchUp(stateVector)]
            : []
        )
        await page.route('**/api/object_info', (route) =>
          route.fulfill(jsonRoute(agentReplayNodeDefs))
        )
        await hostSocket.install()
        await mockAgentTurnApi(page, {
          thread_id: THREAD_ID,
          message_id: FIRST_MESSAGE_ID,
          workflow_id: WORKFLOW_ID
        })
        await page.route('**/api/agent/threads/*/messages', (route) => {
          if (route.request().method() !== 'POST') return route.fallback()
          const body = parsePost(route.request().postData())
          posts.push(body)
          const messageId =
            posts.length === 1 ? FIRST_MESSAGE_ID : SECOND_MESSAGE_ID
          if (posts.length === 2 && body.draft !== undefined) {
            host.apply([
              widgetWrite(FIRST_NODE_ID, FIRST_STALE_VALUE),
              widgetWrite(SECOND_NODE_ID, SECOND_STALE_VALUE),
              titleWrite(FIRST_NODE_ID, staleTitle(FIRST_STALE_VALUE)),
              titleWrite(SECOND_NODE_ID, staleTitle(SECOND_STALE_VALUE))
            ])
          }
          return route.fulfill(
            jsonRoute({
              thread_id: THREAD_ID,
              message_id: messageId,
              workflow_id: WORKFLOW_ID
            })
          )
        })
        await bootAgentApp(page, true, {
          objectInfo: 'server',
          settings: {
            'Comfy.Graph.CanvasInfo': false,
            'Comfy.VueNodes.Enabled': true
          }
        })
        await mockWorkflowPersistence(page, WORKFLOW_ID)

        await panel.open()
        await panel.selectWorkflow()
        await panel.sendMessage('Add two Load Image nodes.')
        await hostSocket.waitForSubscribe()

        hostSocket.send(
          host.apply([
            addLoadImageNode(FIRST_NODE_ID, 0),
            addLoadImageNode(SECOND_NODE_ID, 1),
            titleWrite(FIRST_NODE_ID, staleTitle(FIRST_STALE_VALUE)),
            titleWrite(SECOND_NODE_ID, staleTitle(SECOND_STALE_VALUE))
          ])
        )
        hostSocket.send(done(FIRST_MESSAGE_ID))

        const firstNode = comfyPage.vueNodes.getNodeLocator(
          String(FIRST_NODE_ID)
        )
        const secondNode = comfyPage.vueNodes.getNodeLocator(
          String(SECOND_NODE_ID)
        )
        await expect(firstNode).toBeVisible()
        await expect(secondNode).toBeVisible()
        await expect(firstNode.getByTestId('node-title')).toHaveText(
          staleTitle(FIRST_STALE_VALUE)
        )
        await expect(secondNode.getByTestId('node-title')).toHaveText(
          staleTitle(SECOND_STALE_VALUE)
        )
        await expect(panel.sendButton).toBeVisible()

        mayAnswerSubscribe = false
        const firstConnectionCount = hostSocket.connectionCount()
        await hostSocket.disconnect()
        host.apply([
          widgetWrite(FIRST_NODE_ID, FIRST_FRESH_VALUE),
          widgetWrite(SECOND_NODE_ID, SECOND_FRESH_VALUE),
          titleWrite(FIRST_NODE_ID, freshTitle(FIRST_FRESH_VALUE)),
          titleWrite(SECOND_NODE_ID, freshTitle(SECOND_FRESH_VALUE))
        ])

        await panel.sendMessage('What is on the canvas now?')
        await expect.poll(() => posts.length).toBe(2)
        await expect
          .poll(() => hostSocket.connectionCount())
          .toBeGreaterThan(firstConnectionCount)

        mayAnswerSubscribe = true
        const recoveryConnectionCount = hostSocket.connectionCount()
        await hostSocket.disconnect()
        await expect
          .poll(() => hostSocket.connectionCount(), { timeout: 30_000 })
          .toBeGreaterThan(recoveryConnectionCount)

        hostSocket.send(done(SECOND_MESSAGE_ID))
        await expect(firstNode.getByTestId('node-title')).toHaveText(
          freshTitle(FIRST_FRESH_VALUE)
        )
        await expect(secondNode.getByTestId('node-title')).toHaveText(
          freshTitle(SECOND_FRESH_VALUE)
        )
        await expect(
          panel.root.getByText('What is on the canvas now?')
        ).toBeVisible()
      }
    )
  }
)
