import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import {
  nodesOutsideViewport,
  nodesWithoutGeometry,
  overlappingNodePairs
} from '@e2e/fixtures/utils/nodeLayoutGeometry'

const BATCHED_CASE = 'agent-rec-batched-ops'
const SEQUENTIAL_CASE = 'agent-rec-three-sequential-adds'

// Long enough for geometry to settle after replay, short enough that the known-failing
// case does not spend a default timeout proving it still fails.
const SETTLE = 10_000

test.describe('Agent layout quality', { tag: ['@cloud', '@vue-nodes'] }, () => {
  test.describe('batched build', () => {
    test.use({ conversationCase: BATCHED_CASE })

    test('draws every node without overlapping another', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const nodes = agentConversation.vueNodes.nodes
      expect(await nodes.count()).toBeGreaterThan(1)
      await expect
        .poll(() => nodesWithoutGeometry(nodes), { timeout: SETTLE })
        .toEqual([])

      // Pins a real defect, not a flaky assertion. Measured on this case with the
      // marker removed: two pairs overlap, `2559261621971657 and
      // 2214070360209981 overlap by 216x27px` and `3 and 2559261621971657
      // overlap by 95x32px`. The sequential case below asserts the same property
      // unmarked because it passes, so the marker is scoped to the build mode
      // that actually overlaps rather than to the property.
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

      await expect
        .poll(() => nodesOutsideViewport(page, nodes), { timeout: SETTLE })
        .toEqual([])
    })
  })

  test.describe('sequential build', () => {
    test.use({ conversationCase: SEQUENTIAL_CASE })

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
