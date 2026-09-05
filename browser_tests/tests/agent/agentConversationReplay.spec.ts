import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'

// A run of words the rendered markdown must contain: images dropped, links
// reduced to their label, bare URLs and markup characters removed. A turn
// whose text is only a link yields no probe and is covered by the count floor.
function textProbe(text: string): string | null {
  const words = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>|]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0)
  return words.length >= 3 ? words.slice(0, 6).join(' ') : null
}

test.describe('Agent conversation replay', { tag: '@cloud' }, () => {
  for (const conversationCase of listRecordedConversations()) {
    test.describe(`recorded ${conversationCase}`, () => {
      test.use({ conversationCase })

      test('replays every recorded turn onto the panel and the canvas', async ({
        agentConversation,
        page
      }) => {
        test.setTimeout(90_000)
        const { panel, vueNodes } = agentConversation
        const streams = panel.getByTestId('markdown-stream')
        let turnsWithText = 0

        for (const turn of agentConversation.conversation.turns.keys()) {
          await agentConversation.sendPrompt(turn)
          await agentConversation.replayResponse(turn)
          await agentConversation.waitForTurnComplete()

          const text = agentConversation.recordedAssistantText(turn).trim()
          if (text !== '') {
            turnsWithText += 1
            const probe = textProbe(text)
            if (probe !== null)
              await expect(streams.filter({ hasText: probe })).not.toHaveCount(
                0
              )
            // MarkdownStream renders once per text group, so a turn can own
            // several; every turn with text still owns at least one.
            await expect
              .poll(
                async () =>
                  (await streams.allInnerTexts()).filter((t) => t.trim() !== '')
                    .length
              )
              .toBeGreaterThanOrEqual(turnsWithText)
          }

          // The state after this turn, not only the end state: a node added
          // now and deleted later must be on the canvas now.
          for (const id of agentConversation.addedNodeIds(turn))
            await expect(page.locator(`[data-node-id="${id}"]`)).toBeVisible()
          for (const id of agentConversation.removedNodeIds(turn))
            await expect(page.locator(`[data-node-id="${id}"]`)).toHaveCount(0)
          for (const {
            nodeId,
            widget,
            value
          } of agentConversation.recordedWidgetValues(turn)) {
            const field = page
              .locator(`[data-node-id="${nodeId}"]`)
              .getByLabel(widget, { exact: true })
            if (typeof value === 'number') {
              // Number widgets format their input (0.5 renders as 0.50), so compare the number.
              await expect
                .poll(async () =>
                  Number(await field.locator('input').first().inputValue())
                )
                .toBe(value)
              continue
            }
            const tag = await field.evaluate((el) => el.tagName.toLowerCase())
            if (tag === 'button') await expect(field).toContainText(value)
            else await expect(field).toHaveValue(value)
          }
          // The canvas shows exactly what the multi-player document holds.
          await expect
            .poll(() => agentConversation.renderedNodeIds())
            .toEqual(agentConversation.documentNodeIds())
          for (const connect of agentConversation.recordedConnects(turn)) {
            await expect(
              vueNodes.getOutputSlotRow(connect.fromNode, connect.fromSlot)
            ).toHaveClass(/lg-slot--connected/)
            if (!connect.targetWidgetBacked)
              await expect(
                vueNodes.getInputSlotRow(connect.toNode, connect.toSlot)
              ).toHaveClass(/lg-slot--connected/)
          }
        }

        const calls = agentConversation.recordedToolCalls()
        const groupButtons = panel.getByRole('button', {
          name: /^Ran \d+ tool call/
        })
        if (calls.length > 0) {
          await expect(groupButtons.first()).toBeVisible()
          const expandedCount = async () =>
            (
              await groupButtons.evaluateAll((buttons) =>
                buttons.map((button) => button.getAttribute('aria-expanded'))
              )
            ).filter((state) => state === 'true').length
          const failed = calls.filter((call) => call.failed).length
          if (failed > 0) {
            // A group holding a failed call stays open, and only those do.
            await expect.poll(expandedCount).toBeGreaterThan(0)
            await expect.poll(expandedCount).toBeLessThanOrEqual(failed)
          } else {
            await expect.poll(expandedCount).toBe(0)
          }
        }

        await expect(
          panel.getByRole('button', {
            name: `Open ${agentConversation.conversation.workflow.name}`
          })
        ).toBeVisible()
      })
    })
  }
})
