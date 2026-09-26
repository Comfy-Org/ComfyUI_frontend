/**
 * Regression for the outbound (page -> host doc) leg of the agent CRDT link
 * write path, found while fixing #18275 (inbound realignment) and left open
 * there: see that PR's "Known issue found while fixing the above" section
 * and https://github.com/Comfy-Org/ComfyUI_frontend/pull/18275.
 *
 * The pinned `@comfyorg/comfy-multi-player` applier treats a `connect` op's
 * `to_slot` as a raw index into the DESTINATION NODE'S DOCUMENT-ORDER
 * `inputs` array (`applyConnect` -> `claimConcreteInput` -> `ins.get(toIdx)`),
 * and the wire `ConcreteConnectOp` carries no target-name field, so the fix
 * lives on the MINT side: `attachDocOpMinter` resolves the live slot's NAME
 * against the document's own input order before the op is sent.
 *
 * A node's document-side inputs sit in agent materialization's order -
 * autogrow groups stay CONTIGUOUS (the shape #18275 recorded) - while the
 * live canvas order drifts from it (a slot disconnected and regrown lands at
 * the END of its own group instead of its original ordinal position). A live
 * index minted verbatim would land on whatever input the DOCUMENT happens to
 * hold at that same numeric position, regardless of name or type: PR #18275's
 * live evidence was a VIDEO link's tuple landing on a STRING input.
 */
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { applyOps, mint, project } from '@comfyorg/comfy-multi-player'

import { emitGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { readDocSlotNames } from './liveGraphApplier'
import { toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { attachDocOpMinter } from './docOpMinter'
import type { GraphOperation } from './graphOperations'
import { mintWireOps } from './opEnvelope'

const ROOT_GRAPH_ID = toRootGraphId('root-uuid')

/**
 * Node 2's LIVE canvas inputs: `ref_videos.ref_video_1` was disconnected and
 * regrown, so autogrow appended it after the scalar widgets instead of at
 * its original ordinal position.
 */
const liveNode2 = new LGraphNode('MultiAutogrowReferenceNode')
liveNode2.id = toNodeId(2)
for (const [name, type] of [
  ['ref_images.ref_image_1', 'IMAGE'],
  ['ref_images.ref_image_2', 'IMAGE'],
  ['ref_images.ref_image_3', 'IMAGE'],
  ['ref_videos.ref_video_2', 'VIDEO'],
  ['ref_videos.ref_video_3', 'VIDEO'],
  ['prompt', 'STRING'],
  ['ref_videos.ref_video_1', 'VIDEO'],
  ['ref_image_size', 'INT']
]) {
  liveNode2.addInput(name, type)
}
const rootGraph: LGraph = fromPartial<LGraph>({
  id: ROOT_GRAPH_ID,
  isRootGraph: true,
  getNodeById: (id: unknown) => (String(id) === '2' ? liveNode2 : null)
})
Object.assign(rootGraph, { rootGraph })

const CATALOG: WidgetCatalog = {
  types: {
    VideoSource: { widget_order: [] },
    MultiAutogrowReferenceNode: { widget_order: [] }
  }
}

/**
 * Node 2's DOCUMENT-ORDER inputs. Both autogrow groups (`ref_images`,
 * `ref_videos`) stay contiguous and the scalar widgets (`prompt`,
 * `ref_image_size`) sit after both, matching the real materialized shape
 * #18275 recorded rather than an assumed alphabetical sort. `ref_videos.ref_video_1` sits LAST in its own group
 * (document index 5) because it was disconnected and regrown after
 * `ref_video_2`/`ref_video_3` - regrowth appends to the tail of a group
 * instead of restoring the original ordinal slot, the exact mechanism
 * #18275 fixed for the inbound leg. A fresh array per call: this fixture is
 * a template, not a value other tests in this file could mutate through.
 */
function buildDocOrderInputs(): { name: string; type: string; link: null }[] {
  return [
    { name: 'ref_images.ref_image_1', type: 'IMAGE', link: null },
    { name: 'ref_images.ref_image_2', type: 'IMAGE', link: null },
    { name: 'ref_images.ref_image_3', type: 'IMAGE', link: null },
    { name: 'ref_videos.ref_video_2', type: 'VIDEO', link: null },
    { name: 'ref_videos.ref_video_3', type: 'VIDEO', link: null },
    { name: 'ref_videos.ref_video_1', type: 'VIDEO', link: null },
    { name: 'prompt', type: 'STRING', link: null },
    { name: 'ref_image_size', type: 'INT', link: null }
  ]
}

const REF_VIDEO_1_DOC_INDEX = 5
const PROMPT_DOC_INDEX = 6

/**
 * The LIVE canvas slot index the connection was drawn to - a distinct
 * concept from either document-position constant above, even though it
 * collides with `PROMPT_DOC_INDEX` by construction. That collision is the
 * whole bug this test documents.
 */
const REF_VIDEO_1_LIVE_INDEX = liveNode2.inputs.findIndex(
  ({ name }) => name === 'ref_videos.ref_video_1'
)

function buildSeedWorkflow(): WorkflowJSON {
  return {
    nodes: [
      {
        id: 1,
        type: 'VideoSource',
        pos: [0, 0],
        widgets_values: [],
        inputs: [],
        outputs: [{ name: 'video', type: 'VIDEO', links: [] }]
      },
      {
        id: 2,
        type: 'MultiAutogrowReferenceNode',
        pos: [400, 0],
        widgets_values: [],
        inputs: buildDocOrderInputs(),
        outputs: []
      }
    ],
    links: []
  }
}

interface ProjectedInput {
  name: string
  type: string
  link: unknown
}

interface ProjectedNode {
  inputs: ProjectedInput[]
  outputs: { name: string; type: string; links: unknown[] }[]
}

function projectedNode(doc: ReturnType<typeof mint>, nodeId: number) {
  const workflow = project(doc, CATALOG)
  const node = workflow.nodes.find((n) => String(n.id) === String(nodeId))
  if (!node) throw new Error(`node ${nodeId} missing from projection`)
  if (!Array.isArray(node.inputs)) {
    throw new Error(`node ${nodeId} projected with no inputs array`)
  }
  if (!Array.isArray(node.outputs)) {
    throw new Error(`node ${nodeId} projected with no outputs array`)
  }
  return node as unknown as ProjectedNode
}

function requireInput(
  node: ProjectedNode,
  index: number,
  nodeId: number
): ProjectedInput {
  const input = node.inputs.at(index)
  if (!input) throw new Error(`node ${nodeId} has no input at index ${index}`)
  return input
}

describe('agent CRDT outbound leg: link mint by live position vs. doc order', () => {
  it('lands the link on the named VIDEO input it was drawn to, not on whatever input the doc happens to hold at that live index', async () => {
    expect(REF_VIDEO_1_LIVE_INDEX).toBe(PROMPT_DOC_INDEX)

    // Arrange: the doc host holds node 2 with its inputs in document
    // materialization order (see `buildDocOrderInputs` above).
    const doc = mint(buildSeedWorkflow(), CATALOG)

    // Act: the page's litegraph canvas reconnected `ref_videos.ref_video_1`,
    // whose LIVE slot index (after autogrow interleaving) collides with the
    // numeric position `prompt` occupies in the document's inputs.
    // `attachDocOpMinter` is the real production minter reading the real
    // doc's input order. The `connect` intent is the one `LGraph._addLink`
    // announces once the live link exists.
    const minted: GraphOperation[] = []
    const port = attachDocOpMinter({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      getGraph: () => rootGraph,
      boundRootGraphId: () => ROOT_GRAPH_ID,
      docInputNames: (nodeId) => readDocSlotNames(doc, String(nodeId), 'inputs')
    })

    emitGraphIntent({
      type: 'connect',
      graph: rootGraph,
      link: fromPartial<LLink>({
        id: 204,
        origin_id: toNodeId(1),
        origin_slot: 0,
        target_id: toNodeId(2),
        target_slot: REF_VIDEO_1_LIVE_INDEX,
        type: 'VIDEO'
      })
    })
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(minted).toEqual([
      {
        op: 'connect',
        link_id: 204,
        from_node: toNodeId(1),
        from_slot: 0,
        to_node: toNodeId(2),
        to_slot: REF_VIDEO_1_DOC_INDEX,
        link_type: 'VIDEO'
      }
    ])

    // The real transport step: wire identity, then the real pinned applier -
    // no fixture stand-in for either. Non-zero base version matches the
    // sibling tests' convention so a stamp-ordering quirk can't be mistaken
    // for the slot bug this test targets.
    const [wireOp] = mintWireOps(minted, {
      actor: 'human:u1:tab',
      baseVersion: 1
    })
    const result = applyOps(doc, [wireOp], CATALOG)
    port.detach()

    expect(result.outcomes).toEqual([
      { op_id: wireOp.op_id, outcome: 'applied' }
    ])

    const node1 = projectedNode(doc, 1)
    const node2 = projectedNode(doc, 2)

    // The link the canvas drew onto `ref_videos.ref_video_1` (VIDEO) lands
    // on that named input, and the unrelated `prompt` (STRING) input the
    // live index collides with is left untouched.
    const targetInput = requireInput(node2, REF_VIDEO_1_DOC_INDEX, 2)
    expect(targetInput.name).toBe('ref_videos.ref_video_1')
    expect(targetInput.type).toBe('VIDEO')
    expect(targetInput.link).toBe(204)

    const promptInput = requireInput(node2, PROMPT_DOC_INDEX, 2)
    expect(promptInput.name).toBe('prompt')
    expect(promptInput.type).toBe('STRING')
    expect(promptInput.link).toBeNull()

    // A half-applied connect (destination written, source/top-level links
    // left stale) would still pass the two checks above - confirm both
    // ends of the wire agree the link exists.
    expect(node1.outputs[0]?.links).toContain(204)
    const { links } = project(doc, CATALOG)
    expect(links.some((link) => Array.isArray(link) && link[0] === 204)).toBe(
      true
    )
  })
})
