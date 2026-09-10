import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'

// A recording whose second turn wires two nodes; the first turn only adds.
const WIRING_CASE = 'agent-rec-two-turn-dependent-edit'

test.describe('Agent conversation replay', { tag: '@cloud' }, () => {
  test.describe('wire evidence', () => {
    test.use({ conversationCase: WIRING_CASE })

    // The wire check reads pixels the app's own render loop painted, so a
    // canvas that never repaints after a connect must fail it.
    test('reports a wire the canvas never painted', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)
      const [first, second] = agentConversation.conversation.turns
      const wired = second.response.flatMap((entry) =>
        entry.kind === 'graph_ops'
          ? entry.ops.flatMap((op) =>
              op.op === 'connect'
                ? [
                    `${op.from_node}:${op.from_slot}->${op.to_node}:${op.to_slot}`
                  ]
                : []
            )
          : []
      )
      expect(wired.length, 'the second turn connects').toBeGreaterThan(0)
      expect(first.response.some((entry) => entry.kind === 'graph_ops')).toBe(
        true
      )

      await agentConversation.sendPrompt(0)
      await agentConversation.replayResponse(0)
      await agentConversation.waitForTurnComplete()
      await agentConversation.expectCanvasReplayed(0)

      await agentConversation.panel.page().evaluate(() => {
        window.app!.canvas.drawBackCanvas = () => {}
      })
      await agentConversation.sendPrompt(1)
      await agentConversation.replayResponse(1)
      await agentConversation.waitForTurnComplete()

      await expect
        .poll(() => agentConversation.unpaintedLinks())
        .toEqual(expect.arrayContaining(wired))
    })
  })

  for (const conversationCase of listRecordedConversations()) {
    test.describe(`recorded ${conversationCase}`, () => {
      test.use({ conversationCase })

      test('replays every recorded turn onto the panel and the canvas', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()

        await expect(
          agentConversation.panel.getByRole('button', {
            name: `Open ${agentConversation.conversation.workflow.name}`
          })
        ).toBeVisible()
      })
    })
  }
})
