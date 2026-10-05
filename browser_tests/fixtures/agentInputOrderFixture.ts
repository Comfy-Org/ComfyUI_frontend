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

export const test = agentTest.extend<{
  inputOrderHost: AgentFollowerHostSocket
}>({
  inputOrderHost: async ({ page }, use) => {
    const host = new HostDoc(workflowId, structuredClone(seed), catalog)
    const socket = new AgentFollowerHostSocket(page, workflowId, host)
    await socket.install()

    await mockAgentTurnApi(page, {
      thread_id: threadId,
      message_id: messageId,
      workflow_id: workflowId
    })

    await bootAgentApp(page, true, {
      objectInfo,
      settings: { 'Comfy.Graph.CanvasInfo': false }
    })

    await mockWorkflowPersistence(page, workflowId)
    await loadSeedIntoActiveTab(page, staleCanvasSeed)

    await use(socket)
  }
})
