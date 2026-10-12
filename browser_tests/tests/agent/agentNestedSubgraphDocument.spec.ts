import { expect } from '@playwright/test'

import {
  NESTED_INNER_ID,
  NESTED_OUTER_ID
} from '@e2e/fixtures/data/agent/agentHumanAddBlueprints'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'

test.describe(
  'Nested subgraph definitions arriving from the document',
  { tag: ['@cloud', '@agent', '@canvas', '@node', '@subgraph', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('registers a subgraph nested inside a subgraph that the host put in the document', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn', () =>
        agentConversation.runTurns())

      await test.step('the host seeds the nested definition', () =>
        agentConversation.pushNestedDefinition())

      await test.step('the nested definition renders as a usable canvas node', async () => {
        await expect
          .poll(
            () =>
              page.evaluate(
                (outerId) =>
                  window
                    .app!.graph.subgraphs.get(outerId)
                    ?.nodes.map((node) => ({
                      type: node.type,
                      hasErrors: Boolean(node.has_errors)
                    })) ?? null,
                NESTED_OUTER_ID
              ),
            { timeout: 15_000 }
          )
          .toEqual([{ type: NESTED_INNER_ID, hasErrors: false }])

        const nodeId = await agentConversation.addNodeOfType(
          NESTED_OUTER_ID,
          [300, 300]
        )
        const renderedNode = agentConversation.vueNodes.getNodeLocator(nodeId)
        await expect(renderedNode).toBeVisible()
        await expect(renderedNode.getByTestId('node-title')).toHaveText(
          'nested definition'
        )
      })
    })
  }
)
