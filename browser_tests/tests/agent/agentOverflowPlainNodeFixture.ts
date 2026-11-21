import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import {
  OVERFLOW_PLAIN_MESSAGE_ID,
  OVERFLOW_PLAIN_NODE_TYPE,
  OVERFLOW_PLAIN_THREAD_ID,
  OVERFLOW_PLAIN_WORKFLOW_ID,
  overflowPlainCatalog,
  overflowPlainNodeDef,
  overflowPlainSeed
} from '@e2e/fixtures/data/agent/overflowWidgetPlainNode'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/** The host document and the socket delivering its frames to a booted app. */
interface OverflowPlainHost {
  doc: HostDoc
  socket: AgentFollowerHostSocket
  endTurn: () => void
}

export const overflowPlainNodeTest = agentTest.extend<{
  overflowPlainHost: OverflowPlainHost
}>({
  overflowPlainHost: async ({ page, agentFlagEnabled }, use) => {
    await page.route('**/api/object_info', (route) =>
      route.fulfill(
        jsonRoute({ [OVERFLOW_PLAIN_NODE_TYPE]: overflowPlainNodeDef })
      )
    )

    const doc = new HostDoc(
      OVERFLOW_PLAIN_WORKFLOW_ID,
      overflowPlainSeed,
      overflowPlainCatalog
    )
    const socket = new AgentFollowerHostSocket(
      page,
      OVERFLOW_PLAIN_WORKFLOW_ID,
      doc
    )
    await socket.install()

    await bootAgentApp(page, agentFlagEnabled, {
      objectInfo: 'server',
      settings: { 'Comfy.Graph.CanvasInfo': false },
      beforeNavigate: async (page) => {
        await mockAgentTurnApi(page, {
          thread_id: OVERFLOW_PLAIN_THREAD_ID,
          message_id: OVERFLOW_PLAIN_MESSAGE_ID,
          workflow_id: OVERFLOW_PLAIN_WORKFLOW_ID
        })
        await mockWorkflowPersistence(page, OVERFLOW_PLAIN_WORKFLOW_ID)
      }
    })

    await use({
      doc,
      socket,
      endTurn: () =>
        socket.send({
          type: 'agent_message_done',
          data: {
            message_id: OVERFLOW_PLAIN_MESSAGE_ID,
            thread_id: OVERFLOW_PLAIN_THREAD_ID
          }
        })
    })
  }
})
