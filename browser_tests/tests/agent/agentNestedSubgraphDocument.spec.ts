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

      // No assertion on the host doc here: it would read the fixture's own
      // Node-side Y.Doc one line after the fixture wrote it, with no browser
      // or product code in between, so no regression could fail it.
      await test.step('the host seeds the nested definition', () =>
        agentConversation.pushNestedDefinition())

      await test.step('the nested definition renders as a usable canvas node', async () => {
        // BOTH ids, which is the assertion this case exists for. Polling only
        // the outer left the thing #18148 fixed uncovered: a reader that keeps
        // the outer and answers `{}` for the nested map still builds the outer
        // as `nested definition` with its interior node marked `has_errors`,
        // `subgraph-created` still registers the outer type, and the title
        // assertion below still passes — while the user gets a subgraph whose
        // interior is a placeholder. Dropping `allSubgraphDefinitions`
        // flattening from `liveGraphApplier.registerDefinitions` is a second
        // regression the outer-only poll misses. Reported as the missing ids
        // so a failure names which level was lost.
        await expect
          .poll(
            () =>
              page.evaluate(
                (types) =>
                  // `in` rather than a truthiness check on the indexed value:
                  // `registered_node_types` is typed as a total record, so
                  // oxlint's type-aware `no-unnecessary-condition` rejects
                  // `!registry[type]` as always-falsy. Membership is also the
                  // thing being asserted.
                  types.filter(
                    (type) => !(type in window.LiteGraph!.registered_node_types)
                  ),
                [NESTED_OUTER_ID, NESTED_INNER_ID]
              ),
            { timeout: 15_000 }
          )
          .toEqual([])

        // Registration alone is not the behaviour #18148 fixed — ORDER is.
        // If the outer is configured before the inner, the outer's interior
        // node becomes a `has_errors` placeholder and the inner type is
        // registered straight afterwards, so the poll above and the title
        // assertion below both still pass while the user gets a subgraph whose
        // interior is broken. This is the assertion that fails on that.
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
