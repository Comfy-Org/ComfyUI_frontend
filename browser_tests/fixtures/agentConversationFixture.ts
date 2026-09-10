import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { loadAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import { AgentConversationHarness } from '@e2e/fixtures/helpers/AgentConversationHarness'

interface ConversationFixtures {
  /** Case id of the conversation under `fixtures/data/agent/conversations`. */
  conversationCase: string
  agentConversation: AgentConversationHarness
}

export const agentConversationTest = agentTest.extend<ConversationFixtures>({
  conversationCase: ['', { option: true }],
  agentConversation: async (
    { page, agentFlagEnabled, conversationCase },
    use
  ) => {
    if (conversationCase.length === 0)
      throw new Error('test.use({ conversationCase }) names the conversation')
    const harness = new AgentConversationHarness(
      page,
      loadAgentConversation(conversationCase)
    )
    await harness.boot(agentFlagEnabled)
    await use(harness)
  }
})
