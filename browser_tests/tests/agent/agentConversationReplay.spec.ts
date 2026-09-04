import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'

test.describe('Agent conversation replay', { tag: '@cloud' }, () => {
  for (const conversationCase of listRecordedConversations()) {
    test.describe(`recorded ${conversationCase}`, () => {
      test.use({ conversationCase })

      test('replays the recorded turn onto the panel and the canvas', async ({
        agentConversation,
        page
      }) => {
        test.setTimeout(60_000)
        const { panel } = agentConversation

        await agentConversation.runTurns()

        const calls = agentConversation.recordedToolCalls()
        const groupButtons = panel.getByRole('button', {
          name: /^Ran \d+ tool call/
        })
        if (calls.length > 0) await expect(groupButtons.first()).toBeVisible()
        // A group holding a failed call stays open at turn end; a clean one collapses.
        await expect
          .poll(async () =>
            (
              await groupButtons.evaluateAll((buttons) =>
                buttons.map((button) => button.getAttribute('aria-expanded'))
              )
            ).includes('true')
          )
          .toBe(calls.some((call) => !call.ok))
        for (const button of await groupButtons.all())
          if ((await button.getAttribute('aria-expanded')) === 'false')
            await button.click()
        const toolRows = panel.getByRole('listitem')
        for (const label of new Set(calls.map((call) => call.label)))
          await expect(
            toolRows
              .filter({ has: page.getByText(label, { exact: true }) })
              .first()
          ).toBeVisible()

        await expect(
          panel.getByRole('button', {
            name: `Open ${agentConversation.conversation.workflow.name}`
          })
        ).toBeVisible()
        // MarkdownStream renders once per text group, so one turn can own
        // several; counting streams per turn would not be well defined. Every
        // turn that recorded assistant text must still have rendered some.
        const turnsWithText = [
          ...agentConversation.conversation.turns.keys()
        ].filter(
          (turn) => agentConversation.recordedAssistantText(turn).trim() !== ''
        ).length
        await expect
          .poll(
            async () =>
              (
                await panel.getByTestId('markdown-stream').allInnerTexts()
              ).filter((text) => text.trim() !== '').length
          )
          .toBeGreaterThanOrEqual(turnsWithText)

        for (const id of agentConversation.addedNodeIds()) {
          await expect(page.locator(`[data-node-id="${id}"]`)).toBeVisible()
        }
        for (const id of agentConversation.removedNodeIds()) {
          await expect(page.locator(`[data-node-id="${id}"]`)).toBeHidden()
        }
        for (const {
          nodeId,
          widget,
          value
        } of agentConversation.recordedWidgetValues()) {
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

        // The canvas must show what the multi-player document holds, which is
        // the library's own output rather than a second projection of the ops.
        await expect
          .poll(() => agentConversation.renderedNodeIds())
          .toEqual(expect.arrayContaining(agentConversation.documentNodeIds()))
        // Each connect the recording asked for must render as two connected slot
        // rows, addressed by node id and slot index through the shared helpers.
        for (const {
          fromNode,
          fromSlot,
          toNode,
          toSlot
        } of agentConversation.recordedConnects()) {
          await expect(
            agentConversation.vueNodes.getOutputSlotRow(fromNode, fromSlot)
          ).toHaveClass(/lg-slot--connected/)
          await expect(
            agentConversation.vueNodes.getInputSlotRow(toNode, toSlot)
          ).toHaveClass(/lg-slot--connected/)
        }
      })
    })
  }
})
