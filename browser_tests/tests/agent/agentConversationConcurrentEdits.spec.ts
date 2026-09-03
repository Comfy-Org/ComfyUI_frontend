import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { hasAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'

const HUMAN_TEXT = 'a lighthouse at dawn, typed while the agent works'

// The recording lands with the data PR; without it there is nothing to replay.
if (hasAgentConversation('agent-rec-three-sequential-adds'))
  test.describe(
    'Agent conversation replay with concurrent human edits',
    { tag: '@cloud' },
    () => {
      test.use({ conversationCase: 'agent-rec-three-sequential-adds' })

      test('keeps a human widget edit made between the agent adds', async ({
        agentConversation,
        page
      }) => {
        test.setTimeout(60_000)
        const { conversation } = agentConversation
        const opsEntries = conversation.turns[0].response
          .map((entry, index) => (entry.kind === 'graph_ops' ? index : -1))
          .filter((index) => index >= 0)
        expect(opsEntries.length).toBeGreaterThanOrEqual(3)
        const promptText = page
          .locator('[data-node-id="6"]')
          .getByLabel('text', { exact: true })

        await agentConversation.sendPrompt()
        await agentConversation.replayResponse(0, async (index) => {
          if (index !== opsEntries[0]) return
          await promptText.fill(HUMAN_TEXT)
          await expect
            .poll(() =>
              agentConversation
                .outboundOps()
                .some((op) => op.op === 'set_widget')
            )
            .toBe(true)
        })
        await agentConversation.waitForTurnComplete()

        for (const id of agentConversation.addedNodeIds()) {
          await expect(page.locator(`[data-node-id="${id}"]`)).toBeVisible()
        }
        await expect(promptText).toHaveValue(HUMAN_TEXT)
        expect(
          String(
            agentConversation.hostGraph().nodes['6']?.widgets &&
              (
                agentConversation.hostGraph().nodes['6'].widgets as Record<
                  string,
                  unknown
                >
              ).text
          )
        ).toBe(HUMAN_TEXT)
        await expect
          .poll(() => agentConversation.graphSnapshot())
          .toEqual(agentConversation.expectedGraph())
      })
    }
  )
