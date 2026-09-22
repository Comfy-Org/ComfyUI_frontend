/**
 * Regression for the outbound (page -> host doc) leg of the agent CRDT link
 * write path. Found while fixing #18275 (inbound realignment) but explicitly
 * NOT fixed there: see that PR's "Known issue found while fixing the above"
 * section and https://github.com/Comfy-Org/ComfyUI_frontend/pull/18275.
 *
 * `attachLinkMintPort` mints a `connect` op's `to_slot` from litegraph's LIVE
 * topology (`LinkTopologyView.targetSlot`) with no name lookup at all — see
 * `linkMintPort.ts`'s own doc comment and `linkMintPort.test.ts`. The pinned
 * `@comfyorg/comfy-multi-player` applier then treats that `to_slot` as a raw
 * index into the DESTINATION NODE'S DOCUMENT-ORDER `inputs` array
 * (`applyConnect` -> `claimConcreteInput` -> `ins.get(toIdx)`).
 *
 * When a node's document-side inputs are stored in NAME order (as agent
 * materialization stores them) but the live canvas order has drifted from it
 * (multiple interleaved autogrow groups is the case that surfaced this), the
 * live index minted here lands on whatever input the DOCUMENT happens to hold
 * at that same numeric position, regardless of that input's name or type.
 *
 * This test asserts the CORRECT outcome — the link lands on the input it was
 * actually drawn to, by name, regardless of how the document happens to have
 * that node's inputs ordered — and is RED on `main`: today the applied op
 * instead reproduces the live evidence from PR #18275
 * (`error_reconciling_agent_incompatible_link_type`, a VIDEO link's tuple
 * landing on a STRING input). It does not fix anything.
 */
import { describe, expect, it } from 'vitest'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { applyOps, mint, project } from '@comfyorg/comfy-multi-player'

import type { GraphOperation } from './graphOperations'
import { attachLinkMintPort } from './linkMintPort'
import type { LinkScopeView, LinkTopologyView } from './linkMintPort'
import { createMintSession } from './mintSession'
import { mintWireOps } from './opEnvelope'

const ROOT_SCOPE: LinkScopeView = {
  rootGraphId: 'root-uuid',
  owningGraphId: 'root-uuid'
}

const CATALOG: WidgetCatalog = {
  types: {
    VideoSource: { widget_order: [] },
    MultiAutogrowReferenceNode: { widget_order: [] }
  }
}

/**
 * Node 2's DOCUMENT-ORDER inputs, modeled on the reattach-second-turn
 * evidence: `prompt` (STRING) sits at document index 4, and the real link
 * target, `ref_videos.ref_video_1` (VIDEO), sits at document index 7 -
 * pushed there by two interleaved autogrow groups (`ref_images`,
 * `ref_videos`).
 */
const DOC_ORDER_INPUTS = [
  { name: 'ref_images.ref_image_1', type: 'IMAGE', link: null },
  { name: 'ref_images.ref_image_2', type: 'IMAGE', link: null },
  { name: 'ref_images.ref_image_3', type: 'IMAGE', link: null },
  { name: 'ref_image_size', type: 'INT', link: null },
  { name: 'prompt', type: 'STRING', link: null },
  { name: 'ref_videos.ref_video_2', type: 'VIDEO', link: null },
  { name: 'ref_videos.ref_video_3', type: 'VIDEO', link: null },
  { name: 'ref_videos.ref_video_1', type: 'VIDEO', link: null }
]

const PROMPT_DOC_INDEX = 4
const REF_VIDEO_1_DOC_INDEX = 7

const SEED_WORKFLOW: WorkflowJSON = {
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
      inputs: DOC_ORDER_INPUTS,
      outputs: []
    }
  ],
  links: []
}

function projectedNode(doc: ReturnType<typeof mint>, nodeId: number) {
  const workflow = project(doc, CATALOG)
  const node = workflow.nodes.find((n) => String(n.id) === String(nodeId))
  if (!node) throw new Error(`node ${nodeId} missing from projection`)
  return node as { inputs: { name: string; type: string; link: unknown }[] }
}

describe('agent CRDT outbound leg: link mint by live position vs. doc name order', () => {
  it('lands the link on the named VIDEO input it was drawn to, not on whatever input the doc happens to hold at that live index', () => {
    // Arrange: the doc host holds node 2 with its inputs in NAME order.
    const doc = mint(SEED_WORKFLOW, CATALOG)

    // Act: the page's litegraph canvas reconnected `ref_videos.ref_video_1`,
    // whose LIVE slot index (after autogrow interleaving) is 4 - the same
    // numeric position `prompt` occupies in the DOCUMENT's name-ordered
    // inputs. `attachLinkMintPort` is the real, unmodified production mint
    // port: it mints `to_slot` straight from that live index.
    const minted: GraphOperation[] = []
    const port = attachLinkMintPort({
      events: {
        onPlaced: (listener) => {
          listener(ROOT_SCOPE, {
            id: 204,
            originNodeId: 1,
            originSlot: 0,
            targetNodeId: 2,
            targetSlot: PROMPT_DOC_INDEX,
            type: 'VIDEO'
          } satisfies LinkTopologyView)
          return () => undefined
        },
        onDeleted: () => () => undefined
      },
      session: createMintSession(),
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations)
    })

    expect(minted).toEqual([
      {
        op: 'connect',
        link_id: 204,
        from_node: 1,
        from_slot: 0,
        to_node: 2,
        to_slot: PROMPT_DOC_INDEX,
        link_type: 'VIDEO'
      }
    ])

    // The real transport step: wire identity, then the real pinned applier -
    // no fixture stand-in for either.
    const [wireOp] = mintWireOps(minted, {
      actor: 'human:u1:tab',
      baseVersion: 0
    })
    const result = applyOps(doc, [wireOp], CATALOG)
    port.detach()

    expect(result.outcomes).toEqual([
      { op_id: wireOp.op_id, outcome: 'applied' }
    ])

    const node2 = projectedNode(doc, 2)

    // Correct outcome: the link the canvas drew onto
    // `ref_videos.ref_video_1` (VIDEO) lands on that named input, and the
    // unrelated `prompt` (STRING) input the live index collides with is
    // left untouched. On `main` the applier instead writes the link onto
    // `prompt` by raw position and leaves `ref_videos.ref_video_1` null -
    // this assertion is the one that goes red.
    expect(node2.inputs[REF_VIDEO_1_DOC_INDEX]).toEqual({
      name: 'ref_videos.ref_video_1',
      type: 'VIDEO',
      link: 204
    })
    expect(node2.inputs[PROMPT_DOC_INDEX]).toEqual({
      name: 'prompt',
      type: 'STRING',
      link: null
    })
  })
})
