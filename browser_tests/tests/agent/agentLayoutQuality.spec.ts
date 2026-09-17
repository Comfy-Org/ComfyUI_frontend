import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * Layout quality of agent-built graphs, judged from what the browser draws.
 *
 * Every other check on this behaviour lives in comfy-cli's Python tests, and every
 * one of them scores a *model* of how LiteGraph renders a node: a 30px title band,
 * a width derived from label text at 14px x 0.6 per glyph, 20px slot and widget
 * rows. The model is the thing that was wrong. It placed nodes correctly against a
 * picture the browser does not draw, which is why `cascade_pos` resolved collisions
 * that users then reported as overlapping nodes (FE-1653, and Jo's September 2026
 * QA pass).
 *
 * A test that measures rendered boxes cannot make that mistake. It reads
 * `boundingBox()` off the node elements the renderer actually laid out, so a drift
 * between the CLI's arithmetic and LiteGraph's fails here even when every Python
 * test still passes.
 *
 * The recordings carry the positions the CLI computed, so replay exercises exactly
 * that seam without needing a live agent.
 *
 * Christian, 2026-09-17: "the issue happens when the agent batches graph edits into
 * apply_ops. When the agent does serial / sequential graph edits, it looks better to
 * the user". Production traces agree the batched path is the common one (~87% of
 * node creation), so `agent-rec-batched-ops` is the case that matters and
 * `agent-rec-three-sequential-adds` is the comparison it has to match.
 */

// Cases whose turns add nodes, so there is a layout to judge. Named rather than
// enumerated from disk: a recording that only edits widgets would pass these
// assertions trivially and dilute the signal.
const BATCHED_CASE = 'agent-rec-batched-ops'
const SEQUENTIAL_CASE = 'agent-rec-three-sequential-adds'

interface NodeBox {
  id: string
  x: number
  y: number
  width: number
  height: number
}

const right = (box: NodeBox) => box.x + box.width
const bottom = (box: NodeBox) => box.y + box.height

/**
 * Rendered geometry of every node on the canvas, in viewport pixels.
 *
 * Read from the DOM rather than from `window.app.graph`, deliberately: the graph
 * object holds the positions that were *requested*, which is the same number the
 * CLI computed and therefore proves nothing about how it draws. The element box is
 * the rendered result, including the title bar.
 */
async function renderedNodes(nodes: Locator): Promise<NodeBox[]> {
  const boxes: NodeBox[] = []
  const total = await nodes.count()
  for (let i = 0; i < total; i++) {
    const element = nodes.nth(i)
    const [box, id] = await Promise.all([
      element.boundingBox(),
      element.getAttribute('data-node-id')
    ])
    // A node scrolled out of view has no box. Skipping is correct here -- an
    // off-screen node cannot be shown to overlap -- but it means this assertion
    // is only as strong as the viewport, which is why the fixture opens wide.
    if (box && id) boxes.push({ id, ...box })
  }
  return boxes
}

function overlappingPairs(boxes: NodeBox[]): string[] {
  const found: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const dx = Math.min(right(a), right(b)) - Math.max(a.x, b.x)
      const dy = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y)
      // Sub-pixel rounding in the compositor can report a hairline intersection
      // between boxes that abut exactly. One pixel of tolerance keeps that from
      // reading as the multi-pixel overlap a user would actually see.
      if (dx > 1 && dy > 1) {
        found.push(
          `${a.id} and ${b.id} overlap by ${Math.round(dx)}x${Math.round(dy)}px`
        )
      }
    }
  }
  return found
}

test.describe('Agent layout quality', { tag: '@cloud' }, () => {
  test.describe('batched build', () => {
    test.use({ conversationCase: BATCHED_CASE })

    // KNOWN FAILURE, and the reason this spec was written.
    //
    // Measured on this recording: the two CLIPTextEncode nodes the turn adds
    // overlap by 5.4 screen px, and the first of them overlaps node 3 by 95x11.
    // The arithmetic, at canvas scale 0.9 with a viewport offset of 110:
    //
    //   recorded  pos [715, 280] and [715, 406], size [240, 86]
    //   modelled  86 body + 30 title = 116 graph px tall, so a 10px clear gap
    //   rendered  118.8 screen px = 132 graph px tall, so a 6px overlap
    //
    // The CLI under-measures this node by 20 graph px. Two causes, only one of
    // which is currently fixed: LiteGraph adds 4px after every widget row and 8px
    // after the block (`LGraphNode.computeSize`), which comfy-cli models as a flat
    // 12px and therefore only gets right at exactly one widget; and a multiline
    // text widget renders far taller than the 20px `NODE_WIDGET_HEIGHT` row the
    // CLI assumes for every widget.
    //
    // `test.fail` rather than a skip or a loosened assertion: it passes while the
    // bug exists and FAILS the moment the layout is fixed, so nobody has to
    // remember to come back. Flip it to `test` when the recording is refreshed
    // against a CLI that measures multiline widgets.
    test('draws every node without overlapping another', async ({
      agentConversation
    }) => {
      // Inside the body, not at describe scope: a bare `test.fail()` beside the
      // describe applies to every test after it, which silently marked the
      // viewport test as expected-to-fail too and then failed it for passing.
      test.fail()
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const boxes = await renderedNodes(agentConversation.vueNodes.nodes)
      // Guard the guard: if the replay silently rendered nothing, an empty list
      // would pass every assertion below and report a clean layout for a blank
      // canvas.
      expect(boxes.length).toBeGreaterThan(1)

      expect(
        overlappingPairs(boxes),
        overlappingPairs(boxes).join('; ')
      ).toEqual([])
    })

    test('keeps every node inside the visible canvas', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const boxes = await renderedNodes(agentConversation.vueNodes.nodes)
      expect(boxes.length).toBeGreaterThan(1)

      const viewport = page.viewportSize()
      expect(viewport).not.toBeNull()

      // Jo's third report was "the agent is building super far away from the
      // user's viewpoint" -- distinct from overlap, because nodes can be spaced
      // perfectly and still be somewhere the user is not looking. A node the
      // renderer placed entirely outside the viewport is that failure, and it is
      // invisible to any assertion about the boxes' relationship to each other.
      const offscreen = boxes.filter(
        (box) =>
          right(box) <= 0 ||
          bottom(box) <= 0 ||
          box.x >= viewport!.width ||
          box.y >= viewport!.height
      )
      expect(
        offscreen.map((box) => box.id),
        'nodes rendered outside the viewport'
      ).toEqual([])
    })
  })

  test.describe('sequential build', () => {
    test.use({ conversationCase: SEQUENTIAL_CASE })

    // The serial path is the one users say looks right, so it is the bar rather
    // than a second copy of the same test. If this ever fails while the batched
    // case passes, the premise of the comfy-cli work has inverted and the
    // comparison is worth re-running before trusting either.
    test('draws every node without overlapping another', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const boxes = await renderedNodes(agentConversation.vueNodes.nodes)
      expect(boxes.length).toBeGreaterThan(1)

      expect(
        overlappingPairs(boxes),
        overlappingPairs(boxes).join('; ')
      ).toEqual([])
    })
  })
})
