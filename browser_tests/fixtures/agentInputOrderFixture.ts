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
  threadId,
  workflowId
} from '@e2e/fixtures/data/agent/inputOrder'
import { loadSeedIntoActiveTab } from '@e2e/fixtures/utils/seedActiveTab'

export const test = agentTest.extend<{
  inputOrderHost: AgentFollowerHostSocket
}>({
  inputOrderHost: async ({ page }, use) => {
    const host = new HostDoc(workflowId, structuredClone(seed), catalog)
    const socket = new AgentFollowerHostSocket(
      page,
      workflowId,
      host,
      '6a80fd06-c647-4b17-9f68-202366e468d8'
    )
    await socket.install()

    await mockAgentTurnApi(page, {
      thread_id: threadId,
      message_id: messageId,
      workflow_id: workflowId
    })

    await bootAgentApp(page, true, {
      objectInfo,
      settings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Graph.CanvasInfo': false
      }
    })

    await mockWorkflowPersistence(page, workflowId)
    await loadSeedIntoActiveTab(page, seed)

    await use(socket)
  }
})
