import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import {
  catalog,
  messageId,
  objectInfo,
  seed,
  staleCanvasSeed,
  threadId,
  workflowId
} from '@e2e/fixtures/data/agent/inputOrder'
import { loadSeedIntoActiveTab } from '@e2e/fixtures/utils/seedActiveTab'

const SOCKET_SID = '6a80fd06-c647-4b17-9f68-202366e468d8'

export const test = agentTest.extend<{
  inputOrderHost: AgentFollowerHostSocket
}>({
  inputOrderHost: async ({ page }, use) => {
    const host = new HostDoc(workflowId, structuredClone(seed), catalog)
    const socket = new AgentFollowerHostSocket(
      page,
      workflowId,
      host,
      SOCKET_SID
    )
    await socket.install()

    await mockAgentTurnApi(page, {
      thread_id: threadId,
      message_id: messageId,
      workflow_id: workflowId
    })

    // `bootAgentApp` turns Vue nodes on for the `@vue-nodes` tag this spec
    // carries, so only the canvas-info overlay has to be set here.
    await bootAgentApp(page, true, {
      objectInfo,
      settings: { 'Comfy.Graph.CanvasInfo': false }
    })

    await mockWorkflowPersistence(page, workflowId)
    // `staleCanvasSeed`, not `seed`: the canvas starts one revision behind
    // the host so that the values the spec asserts after catch-up are wrong
    // here first.
    await loadSeedIntoActiveTab(page, staleCanvasSeed)

    await use(socket)
  }
})
