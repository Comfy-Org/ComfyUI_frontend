import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

// PM-1440: the per-turn credits line arrives on the `agent_message_done`
// socket frame and nowhere else — the persisted history row deliberately
// carries no charge (`AgentMessage` in @comfyorg/ingest-types: "Per-turn token
// accounting is NOT included here"). So every rehydrate of a thread rebuilds
// its messages without `creditsUsed` and the line vanishes for the whole
// conversation. Leaving the chat and coming back is the cheapest way a user
// hits that, and the value it loses is one the client already received from
// the server for that exact turn.
test.describe.configure({ timeout: 120_000 })
test.use({
  workflowSelectionFeatures: {
    'agent-credit-usage-summary': 'treatment'
  },
  // The charge is served against the assistant row id and a hydrated turn is
  // keyed by `turn_id`. Collapsing those two makes this spec pass against the
  // very bug it is here for, so it asks for the production shape.
  serverTurnIds: 'distinct'
})

test(
  'keeps the reported Agent credits when the chat is reopened from history',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory }) => {
    await expect(
      page.getByTestId('integrated-tab-bar-actions')
    ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 8_000 })
    const agentPanel = new AgentPanel(page)
    await agentPanel.open()
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()

    const prompt = 'Add a KSampler node.'
    await agentPanel.composer.fill(prompt)
    await agentPanel.sendButton.click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    await promptHistory.finishLatestTurn('Done.', 6038)

    const liveUsage = agentPanel.root.getByTestId('agent-credit-usage')
    await expect(liveUsage).toHaveText('Agent used 1.27 credits')

    // Leave for a new chat, then reopen the one we just spent credits in. The
    // reopen re-reads `GET /threads/:id/messages` and replays it through
    // `agentConversationStore.hydrate()`, which is the path that used to drop
    // the credits line.
    const historyReadsBefore = promptHistory.historyReads()
    await agentPanel.newChatButton.click()
    await expect(liveUsage).toHaveCount(0)
    await agentPanel.openChatFromHistory('Inline reference round trip')
    await expect
      .poll(() => promptHistory.historyReads())
      .toBeGreaterThan(historyReadsBefore)

    // The transcript came back, so a failure below is the credits line
    // specifically and not a thread that never reopened.
    await expect(agentPanel.userMessageBubbles).toHaveText([prompt])
    await expect(liveUsage).toHaveText('Agent used 1.27 credits')
  }
)
