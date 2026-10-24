import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  ADDITIVE_CANVAS_CASE,
  ADDITIVE_READINESS_NODE_ID,
  ADDITIVE_READINESS_WIDGET
} from '@e2e/fixtures/data/agent/agentCanvasAdditive'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

/**
 * PM-1495 — "Links are not rendered on the canvas, including hand-drawn ones".
 *
 * Split out of PM-828 on 2026-09-21. PM-828's other facet (nodes drawn
 * translucent and unselectable) was root-caused to a `flags.ghost` leak into
 * the CRDT document and fixed in #18191, whose body says outright that it
 * covers the ghost-node half only. This facet never got a root cause, and the
 * ticket's own open question since then has been whether it still reproduces
 * now that #18700 replaced the frontend sync layer.
 *
 * The report has two halves and they need different assertions:
 *
 *  1. the agent wired a workflow and every node arrived drawn unconnected, and
 *  2. the tester then wired two nodes together *by hand* and no link drew either.
 *
 * Half 2 is what makes this a rendering claim rather than an agent-wiring
 * claim: a hand drag goes nowhere near the follower. So asserting the
 * serialized graph — which `expectCanvasReplayed` already does for every
 * recorded case — cannot see this defect at all. A graph whose links are all
 * present and correct is exactly the state the report describes.
 *
 * What a painted link is observable through: `LGraphCanvas.drawConnections`
 * clears `renderedPaths` at the top of every frame and adds each link segment
 * it actually strokes. So the set of ids in `renderedPaths` is the renderer's
 * own account of what the user can see, read the same way
 * `rerouteNode.spec.ts` reads it to find a link's midpoint on screen. It is
 * paired below with the DOM slot-row state (`lg-slot--connected`), which is
 * the signal `expectCanvasReplayed` uses, so a regression has to defeat two
 * independent visible surfaces rather than one.
 *
 * Links outside the viewport are culled by design
 * (`LGraphCanvas.ts`, `overlapBounding(link_bounding, margin_area)`), and a
 * recorded tab switch parks the viewport at the origin. Both halves therefore
 * fit the view first; without that this spec would assert viewport luck.
 */

/**
 * Four connects plus one `add_node` onto the default text-to-image seed: the
 * new KSampler takes LATENT from sampler 3, MODEL from the checkpoint and
 * CONDITIONING from the prompt encoder, and its own LATENT drives the VAE
 * decoder. Links into a node the follower minted this turn and links between
 * two pre-existing nodes are both covered by one case.
 */
const CASE = 'agent-rec-refiner-between'

/** The seed's only CLIPTextEncode. Its CONDITIONING output is the hand drag's source. */
const PROMPT_ENCODER_ID = '6'

/** The KSampler the recorded turn adds. `negative` is the slot it leaves free. */
const REFINER_ID = '2092962753103866'

/**
 * The report's primary wording is that the agent *loaded* a workflow and the
 * nodes "arrived drawn unconnected", which is `insert_workflow` rather than a
 * sequence of `connect` ops. The two reach the live graph by different routes
 * — an insert is remapped by comfy-multi-player before the applier sees it —
 * so the second case below exercises that one. `agentCanvasAdditive`'s
 * existing `INSERT_WORKFLOW` carries no links, which is exactly the thing
 * under test here, hence a linked payload of its own.
 */
const LINKED_INSERT: RecordedGraphOperation = {
  op: 'insert_workflow',
  workflow: {
    nodes: [
      {
        id: 870001,
        type: 'CheckpointLoaderSimple',
        pos: [1900, 900],
        size: [315, 98],
        mode: 0,
        flags: {},
        order: 0,
        inputs: [],
        outputs: [
          { name: 'MODEL', type: 'MODEL', links: [] },
          { name: 'CLIP', type: 'CLIP', links: [870010] },
          { name: 'VAE', type: 'VAE', links: [] }
        ],
        properties: {},
        widgets_values: ['sd_xl_base_1.0.safetensors']
      },
      {
        id: 870002,
        type: 'CLIPTextEncode',
        pos: [2300, 900],
        size: [400, 200],
        mode: 0,
        flags: {},
        order: 1,
        inputs: [{ name: 'clip', type: 'CLIP', link: 870010 }],
        outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
        properties: {},
        widgets_values: ['a painted link']
      }
    ],
    links: [[870010, 870001, 1, 870002, 0, 'CLIP']]
  }
}

/**
 * Link ids the renderer stroked, read off a frame drawn just now.
 *
 * The forced draw is load-bearing, not belt-and-braces: `renderedPaths` keeps
 * the last frame's contents until the next one clears it, so reading it
 * straight after an assertion that already triggered a draw can describe a
 * frame drawn before the state under test existed. A probe that stopped link
 * painting *after* the last draw was reported green by an earlier revision of
 * this helper, which is precisely the stale-frame read this avoids.
 */
async function paintedLinkIds(page: Page): Promise<number[]> {
  const ids = await page.evaluate(() => {
    const canvas = window.app?.canvas
    if (!canvas?.renderedPaths) return []
    canvas.draw(true, true)
    return (
      [...canvas.renderedPaths]
        // Reroutes share this set with links; only links carry endpoints.
        .filter((segment) => 'origin_id' in segment)
        .map((segment) => Number(segment.id))
    )
  })
  return ids.sort((a, b) => a - b)
}

/** Link ids the graph holds, i.e. what the renderer is being asked to draw. */
async function graphLinkIds(page: Page): Promise<number[]> {
  const ids = await page.evaluate(() =>
    [...window.app!.graph.links.keys()].map(Number)
  )
  return ids.sort((a, b) => a - b)
}

/**
 * Index of an input slot by name. Read live rather than hardcoded: a slot
 * order assumption is the kind of thing that makes a rendering spec fail for
 * an unrelated reason.
 */
async function inputSlotIndex(
  page: Page,
  nodeId: string,
  name: string
): Promise<number> {
  const index = await page.evaluate(
    ([id, slotName]) => {
      const node = window.app?.graph.getNodeById(id)
      return (node?.inputs ?? []).findIndex((input) => input.name === slotName)
    },
    [toNodeId(nodeId), name] as const
  )
  expect(
    index,
    `node ${nodeId} has no input slot named ${name}`
  ).toBeGreaterThanOrEqual(0)
  return index
}

test.describe(
  'Links on the canvas are painted, not just present in the graph',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE })

    test('PM-1495: every link the agent wires is drawn, and so is one the user then draws by hand', async ({
      agentConversation,
      comfyPage,
      page
    }) => {
      // A full recorded turn plus two fit-view/render settles; the default 30s
      // budget is too tight for CI, matching the other replay specs.
      test.setTimeout(120_000)

      await test.step('replay the recorded turn that wires the refiner in', () =>
        agentConversation.runTurns())

      const agentLinkIds =
        await test.step('half 1: the agent-built links are drawn on the canvas', async () => {
          await agentConversation.fitCanvasToGraph()
          const expected = await graphLinkIds(page)
          // Guard the guard: a seed that lost its links would make the
          // assertion below vacuously true.
          expect(expected.length).toBeGreaterThanOrEqual(4)
          await expect
            .poll(() => paintedLinkIds(page), { timeout: 15_000 })
            .toEqual(expected)
          return expected
        })

      await test.step('half 2: a link the user draws by hand is drawn too', async () => {
        const encoder =
          await comfyPage.nodeOps.getNodeRefById(PROMPT_ENCODER_ID)
        const refiner = await comfyPage.nodeOps.getNodeRefById(REFINER_ID)
        const negative = await inputSlotIndex(page, REFINER_ID, 'negative')

        // CONDITIONING -> CONDITIONING on a slot the recording left free, so
        // the drag is a legal connection the canvas must accept.
        await comfyPage.canvasOps.dragAndDrop(
          await (await encoder.getOutput(0)).getPosition(),
          await (await refiner.getInput(negative)).getPosition()
        )

        const withHandDrawn = await graphLinkIds(page)
        expect(
          withHandDrawn,
          'the hand drag did not create a link, so this spec never reached the rendering question'
        ).toHaveLength(agentLinkIds.length + 1)

        await agentConversation.fitCanvasToGraph()
        await expect
          .poll(() => paintedLinkIds(page), { timeout: 15_000 })
          .toEqual(withHandDrawn)

        // The second visible surface: both endpoints report themselves
        // connected in the DOM, the way `expectCanvasReplayed` reads a link.
        const handDrawnId = withHandDrawn.find(
          (id) => !agentLinkIds.includes(id)
        )!
        const endpoints = await page.evaluate((id) => {
          const link = window.app!.graph.links.get(id)!
          return {
            fromNode: String(link.origin_id),
            fromSlot: link.origin_slot,
            toNode: String(link.target_id),
            toSlot: link.target_slot
          }
        }, toLinkId(handDrawnId))
        await expect(
          agentConversation.vueNodes.getOutputSlotRow(
            endpoints.fromNode,
            endpoints.fromSlot
          )
        ).toHaveClass(/lg-slot--connected/)
        await expect(
          agentConversation.vueNodes.getInputSlotRow(
            endpoints.toNode,
            endpoints.toSlot
          )
        ).toHaveClass(/lg-slot--connected/)
      })
    })
  }
)

test.describe(
  'A workflow the agent loads arrives with its links drawn',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    // A text-only turn binds the follower without touching the graph, so the
    // insert below is the only thing that puts links on the canvas.
    test.use({ conversationCase: ADDITIVE_CANVAS_CASE, humanOpsHost: 'apply' })

    test('PM-1495: an inserted workflow does not arrive drawn unconnected', async ({
      agentConversation,
      comfyPage,
      page
    }) => {
      test.setTimeout(120_000)

      await test.step('replay the recorded turn so the follower is bound', () =>
        agentConversation.runTurns())

      const before = await graphLinkIds(page)

      await test.step('the agent loads a two-node workflow with a link in it', () =>
        agentConversation.pushHostOps([LINKED_INSERT]))

      await test.step('let the insert land', () =>
        agentConversation.waitForPendingFrames(
          ADDITIVE_READINESS_NODE_ID,
          ADDITIVE_READINESS_WIDGET,
          'linked insert landed'
        ))

      await comfyPage.nextFrame()

      const after = await graphLinkIds(page)
      // `insert_workflow` remaps ids, so the payload's 870010 is not the id
      // that lands. Assert the count moved instead, then that whatever landed
      // is painted — the remap is not what this spec is about.
      expect(
        after,
        'the insert put no link on the graph, so this spec never reached the rendering question'
      ).toHaveLength(before.length + 1)

      await agentConversation.fitCanvasToGraph()
      await expect
        .poll(() => paintedLinkIds(page), { timeout: 15_000 })
        .toEqual(after)
    })
  }
)
