import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import {
  listRecordedConversations,
  loadAgentConversation
} from '@e2e/fixtures/data/agent/agentConversation'
import {
  expectedGraphSnapshot,
  expectedUpdateCount,
  recordedAddedNodeIds,
  recordedToolCallGroups,
  recordedWidgetValues,
  toolRowLabel
} from '@e2e/fixtures/data/agent/agentConversationExpectations'

test.describe('Agent conversation replay', { tag: '@cloud' }, () => {
  for (const conversationCase of listRecordedConversations()) {
    const conversation = loadAgentConversation(conversationCase)
    const groups = recordedToolCallGroups(conversation)

    test.describe(`recorded ${conversationCase}`, () => {
      test.use({ conversationCase })

      test(`replays: ${conversation.request.content}`, async ({
        agentConversation,
        page
      }) => {
        test.setTimeout(60_000)
        const { panel } = agentConversation

        await agentConversation.sendPrompt()
        await agentConversation.replayResponse()
        await agentConversation.waitForTurnComplete()

        const groupButtons = panel.getByRole('button', {
          name: /^Ran \d+ tool call/
        })
        await expect(groupButtons).toHaveCount(groups.length)
        const toolRows = panel.getByRole('listitem')
        for (const [index, calls] of groups.entries()) {
          const button = groupButtons.nth(index)
          const succeeded = calls.every((call) => call.ok)
          await expect(button).toHaveText(
            new RegExp(`^Ran ${calls.length} tool call`)
          )
          // A failed group stays open at turn end; a clean one collapses.
          await expect(button).toHaveAttribute(
            'aria-expanded',
            succeeded ? 'false' : 'true'
          )
          if (succeeded) await button.click()
          for (const call of calls) {
            await expect(
              toolRows.filter({ hasText: toolRowLabel(call.name) }).first()
            ).toBeVisible()
          }
        }

        await expect(
          panel.getByRole('button', {
            name: `Open ${conversation.workflow.name}`
          })
        ).toBeVisible()
        await expect(
          panel.getByTestId('markdown-stream').first()
        ).not.toBeEmpty()
        await expect(panel.getByTestId('agent-crdt-status')).toContainText(
          'connected'
        )
        await expect(panel.getByTestId('agent-crdt-status')).toContainText(
          `${expectedUpdateCount(conversation)} updates`
        )

        const graph = agentConversation.hostGraph()
        for (const id of recordedAddedNodeIds(conversation, graph)) {
          await expect(page.locator(`[data-node-id="${id}"]`)).toBeVisible()
        }
        for (const { nodeId, widget, value } of recordedWidgetValues(
          conversation,
          graph
        )) {
          const field = page
            .locator(`[data-node-id="${nodeId}"]`)
            .getByLabel(widget, { exact: true })
          const control =
            typeof value === 'string' ? field : field.locator('input')
          await expect(control).toHaveValue(String(value))
        }

        await expect
          .poll(() => agentConversation.graphSnapshot())
          .toEqual(expectedGraphSnapshot(conversation, graph))
      })
    })
  }
})
