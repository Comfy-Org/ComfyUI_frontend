import { expect } from '@playwright/test'

import {
  NESTED_INNER_ID,
  NESTED_OUTER_ID
} from '@e2e/fixtures/data/agent/agentHumanAddBlueprints'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// The same text-only turn the other human-add cases bind to: the follower
// subscribes to the recorded workflow's doc and the agent changes nothing, so
// the seeded definition is the only thing under test.
const CASE = 'agent-rec-text-only-answer'

/**
 * A subgraph definition that carries another subgraph inside it, arriving from
 * the document rather than from a local paste.
 *
 * The distinction is the whole point of the case. A blueprint pasted on the
 * page registers its definitions locally on the way in, so it never exercises
 * the follower's document reader at all - a spec built on the paste path
 * passes with the reader broken. Only a definition the host puts in the
 * document forces the follower to project it back out.
 *
 * When the reader cannot read a nested `definitions` map it drops the *outer*
 * definition with it: `isSafeDefinition` rejects an id-keyed object where
 * `subgraphs` has to be an array, `readDefinition` answers null, and neither
 * definition is ever registered. A root node typed by that definition then has
 * no registered type, so `LiteGraph.createNode()` answers null and the canvas
 * degrades it to an error placeholder.
 *
 * Source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/18148
 * (`fix(agent): preserve nested subgraph definition order`), which shipped
 * with unit cover only.
 */
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

      await test.step('the host seeds the nested definition', () => {
        agentConversation.pushNestedDefinition()
        expect(
          agentConversation.hostNestedDefinitionIds(NESTED_OUTER_ID)
        ).toEqual([NESTED_INNER_ID])
      })

      await test.step('the nested definition renders as a usable canvas node', async () => {
        await expect
          .poll(
            () =>
              page.evaluate(
                (type) =>
                  Boolean(window.LiteGraph?.registered_node_types[type]),
                NESTED_OUTER_ID
              ),
            { timeout: 15_000 }
          )
          .toBeTruthy()

        const nodeId = await agentConversation.addNodeOfType(
          NESTED_OUTER_ID,
          [300, 300]
        )
        const renderedNode = page.locator(`[data-node-id="${nodeId}"]`)
        await expect(renderedNode).toBeVisible()
        await expect(renderedNode.getByTestId('node-title')).toHaveText(
          'nested blueprint'
        )
      })
    })
  }
)
