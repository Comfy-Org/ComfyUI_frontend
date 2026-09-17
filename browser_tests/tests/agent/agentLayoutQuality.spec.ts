import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import {
  nodesOutsideViewport,
  overlappingNodePairs
} from '@e2e/fixtures/utils/nodeLayoutGeometry'

/**
 * Layout of agent-built graphs, judged from what the browser draws.
 *
 * Node positions are chosen outside the browser, from a model of how LiteGraph renders
 * a node. Only a rendered-geometry assertion catches the two disagreeing, which is the
 * failure users see as overlapping nodes.
 *
 * Recordings carry the positions that were chosen for them, so replay exercises that
 * seam without a live agent.
 */

const BATCHED_CASE = 'agent-rec-batched-ops'
const SEQUENTIAL_CASE = 'agent-rec-three-sequential-adds'

// Long enough for geometry to settle after replay, short enough that the known-failing
// case does not spend a default timeout proving it still fails.
const SETTLE = 10_000

test.describe('Agent layout quality', { tag: '@cloud' }, () => {
  test.describe('batched build', () => {
    test.use({ conversationCase: BATCHED_CASE })

    test('draws every node without overlapping another', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const nodes = agentConversation.vueNodes.nodes
      expect(await nodes.count()).toBeGreaterThan(1)

      // Known failure: the batched path currently overlaps nodes. Marked here rather
      // than at the top of the test so a replay failure, or a canvas that renders
      // nothing, stays unexpected instead of satisfying the expected-failure status.
      // When this reports "Expected to fail, but passed", the layout is fixed and the
      // marker should be removed.
      test.fail()
      await expect
        .poll(() => overlappingNodePairs(nodes), { timeout: SETTLE })
        .toEqual([])
    })

    test('draws every node inside the viewport', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const nodes = agentConversation.vueNodes.nodes
      expect(await nodes.count()).toBeGreaterThan(1)

      // Distinct from overlap: nodes can be spaced perfectly and still be built where
      // the user is not looking.
      await expect
        .poll(() => nodesOutsideViewport(page, nodes), { timeout: SETTLE })
        .toEqual([])
    })
  })

  test.describe('sequential build', () => {
    test.use({ conversationCase: SEQUENTIAL_CASE })

    // The control. Sequential edits are the path users report as looking right, so if
    // this ever fails while the batched case passes, the two have swapped and both
    // results are suspect.
    test('draws every node without overlapping another', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const nodes = agentConversation.vueNodes.nodes
      expect(await nodes.count()).toBeGreaterThan(1)

      await expect
        .poll(() => overlappingNodePairs(nodes), { timeout: SETTLE })
        .toEqual([])
    })
  })
})
