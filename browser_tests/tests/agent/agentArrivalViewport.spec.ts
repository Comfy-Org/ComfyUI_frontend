import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { AgentConversation } from '@e2e/fixtures/data/agent/agentConversation'

/**
 * Where an agent build ends up relative to what the user is looking at.
 *
 * Node positions are chosen outside the browser, from the graph's bounding box
 * rather than from the camera, so on a wide graph the new nodes are placed past
 * the edge of the view. Nothing but a rendered-geometry assertion can tell that
 * apart from a build that landed in front of the user: the ops apply, the nodes
 * exist, and the panel reports success either way.
 *
 * The visible area is the page viewport minus the docked panel, measured from
 * the panel's own box. A node drawn behind the panel is painted but not seen,
 * and an assertion against the bare viewport calls it visible.
 */

// Adds at x 1845, 2165 and 2485, past the right edge of the canvas the panel
// leaves visible - the shape users report as "built where I am not looking".
const SEQUENTIAL_CASE = 'agent-rec-three-sequential-adds'
// The control: adds at x 715, inside the seed graph and already on screen, so
// this one must not move the camera.
const BATCHED_CASE = 'agent-rec-batched-ops'

// Long enough for the framing animation and the resulting layout to settle.
const SETTLE = 10_000

function isIdLike(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

/** Node ids the recording's ops add, in the order the agent builds them. */
function addedNodeIds(conversation: AgentConversation): string[] {
  return conversation.turns
    .flatMap((turn) => turn.response)
    .flatMap((entry) => (entry.kind === 'graph_ops' ? entry.ops : []))
    .filter((op) => op.op === 'add_node')
    .map((op) => (op as { node_id?: unknown }).node_id)
    .filter(isIdLike)
    .map(String)
}

/**
 * Ids among `ids` whose node is not wholly inside the canvas the panel leaves
 * visible. A node with no box is reported too: `boundingBox()` is null for an
 * element that is not rendered, which must not read as "on screen".
 */
async function nodesOutsideVisibleCanvas(
  page: Page,
  panel: Locator,
  ids: readonly string[]
): Promise<string[]> {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('this assertion needs a sized page')
  const panelBox = await panel.boundingBox()
  const visible = {
    right: panelBox ? Math.min(panelBox.x, viewport.width) : viewport.width,
    bottom: viewport.height
  }

  const seen = await Promise.all(
    ids.map(async (id) => {
      const box = await page.locator(`[data-node-id="${id}"]`).boundingBox()
      return { id, inside: box !== null && contains(visible, box) }
    })
  )
  return seen
    .filter((node) => !node.inside)
    .map((node) => node.id)
    .sort()
}

function contains(
  visible: { right: number; bottom: number },
  box: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= visible.right &&
    box.y + box.height <= visible.bottom
  )
}

test.describe('Agent build arrival', { tag: '@cloud' }, () => {
  test.describe('build placed past the edge of the view', () => {
    test.use({ conversationCase: SEQUENTIAL_CASE })

    test('leaves every node it added on screen', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const added = addedNodeIds(agentConversation.conversation)
      expect(added.length).toBeGreaterThan(0)

      await agentConversation.runTurns()

      await expect
        .poll(
          () => nodesOutsideVisibleCanvas(page, agentConversation.panel, added),
          { timeout: SETTLE }
        )
        .toEqual([])
    })
  })

  test.describe('build placed in front of the user', () => {
    test.use({ conversationCase: BATCHED_CASE })

    // The camera must not be yanked out from under someone whose work the agent
    // is editing in place, so this case is only allowed to leave it alone.
    test('does not move the camera off the graph it was already showing', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const added = addedNodeIds(agentConversation.conversation)
      expect(added.length).toBeGreaterThan(0)

      const before = await page.evaluate(() => {
        const { ds } = window.app!.canvas
        return { scale: ds.scale, offset: [...ds.offset] }
      })

      await agentConversation.runTurns()

      await expect
        .poll(
          () => nodesOutsideVisibleCanvas(page, agentConversation.panel, added),
          { timeout: SETTLE }
        )
        .toEqual([])
      expect(
        await page.evaluate(() => {
          const { ds } = window.app!.canvas
          return { scale: ds.scale, offset: [...ds.offset] }
        })
      ).toEqual(before)
    })
  })
})
