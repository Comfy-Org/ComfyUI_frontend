import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * Where an agent build ends up relative to what the user is looking at.
 *
 * Node positions are chosen outside the browser, from the graph's bounding box
 * rather than from the camera, so on a wide graph the new nodes are placed past
 * the edge of the view. Successful ops and node existence alone do not prove
 * that the rendered result is visible to the user.
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

test.describe('Agent build arrival', { tag: '@cloud' }, () => {
  test.describe('build placed past the edge of the view', () => {
    test.use({ conversationCase: SEQUENTIAL_CASE })

    test('leaves every node it added on screen', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)
      const added = agentConversation.addedNodeIds()
      expect(added.length).toBeGreaterThan(0)

      await agentConversation.runTurns()

      await expect
        .poll(() => agentConversation.nodesOutsideVisibleCanvas(added), {
          timeout: SETTLE
        })
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
      const added = agentConversation.addedNodeIds()
      expect(added.length).toBeGreaterThan(0)

      const before = await page.evaluate(() => {
        const { ds } = window.app!.canvas
        return { scale: ds.scale, offset: [...ds.offset] }
      })

      await agentConversation.runTurns()

      await expect
        .poll(() => agentConversation.nodesOutsideVisibleCanvas(added), {
          timeout: SETTLE
        })
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
