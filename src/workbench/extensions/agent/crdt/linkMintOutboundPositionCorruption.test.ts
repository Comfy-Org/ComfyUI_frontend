/**
 * Regression for the outbound (page -> host doc) leg of the agent CRDT link
 * write path. Found while fixing #18275 (inbound realignment) but explicitly
 * NOT fixed there: see that PR's "Known issue found while fixing the above"
 * section and https://github.com/Comfy-Org/ComfyUI_frontend/pull/18275.
 *
 * `attachLinkMintPort` mints a `connect` op's `to_slot` from litegraph's LIVE
 * topology (`LinkTopologyView.targetSlot`) with no name lookup at all - see
 * `linkMintPort.ts`'s own doc comment and `linkMintPort.test.ts`. The pinned
 * `@comfyorg/comfy-multi-player` applier then treats that `to_slot` as a raw
 * index into the DESTINATION NODE'S DOCUMENT-ORDER `inputs` array
 * (`applyConnect` -> `claimConcreteInput` -> `ins.get(toIdx)`). The wire
 * `ConcreteConnectOp` carries no target-name field at all (see the pinned
 * package's `types.d.ts`), so the applier - a package this repo does not
 * control - has nothing to resolve a name against even in principle: a real
 * fix can only live on the MINT side, computing `to_slot` from the target's
 * name against the doc's order before the op is sent.
 *
 * When a node's document-side inputs sit in agent materialization's order -
 * autogrow groups stay CONTIGUOUS, as `multiAutogrowInputOrder.ts`'s
 * `savedNode` (landed with #18275) shows, not some guessed alphabetical
 * sort - but the live canvas order has drifted from it (a slot disconnected
 * and regrown lands at the END of its own group instead of its original
 * ordinal position), the live index minted here can land on whatever input
 * the DOCUMENT happens to hold at that same numeric position, regardless of
 * that input's name or type.
 *
 * This test asserts the CORRECT outcome - the link lands on the input it was
 * actually drawn to, by name, regardless of how the document happens to have
 * that node's inputs ordered - and is RED on `main`: today the applied op
 * instead reproduces the live evidence from PR #18275
 * (`error_reconciling_agent_incompatible_link_type`, a VIDEO link's tuple
 * landing on a STRING input). It does not fix anything: like the sibling
 * regressions landed ahead of their fix in this directory (e.g.
 * `agentCrdtProjection.tabReturn.test.ts`), it uses `it.fails` so
 * `pnpm test:unit` collects it as an expected failure instead of a red run.
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
 * Node 2's DOCUMENT-ORDER inputs. Both autogrow groups (`ref_images`,
 * `ref_videos`) stay contiguous and the scalar widgets (`prompt`,
 * `ref_image_size`) sit after both, matching the real materialized shape in
 * `multiAutogrowInputOrder.ts`'s `savedNode` (#18275) rather than an assumed
 * alphabetical sort. `ref_videos.ref_video_1` sits LAST in its own group
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
const REF_VIDEO_1_LIVE_INDEX = 6

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
  it.fails('lands the link on the named VIDEO input it was drawn to, not on whatever input the doc happens to hold at that live index', () => {
    // Arrange: the doc host holds node 2 with its inputs in document
    // materialization order (see `buildDocOrderInputs` above).
    const doc = mint(buildSeedWorkflow(), CATALOG)

    // Act: the page's litegraph canvas reconnected `ref_videos.ref_video_1`,
    // whose LIVE slot index (after autogrow interleaving) collides with the
    // numeric position `prompt` occupies in the document's inputs.
    // `attachLinkMintPort` is the real, unmodified production mint port: it
    // mints `to_slot` straight from that live index. The listener is
    // captured and invoked AFTER `attachLinkMintPort` returns, the way
    // production's `registerLinkTopology` bridge fires it, matching
    // `linkMintPort.test.ts`'s `place()` helper rather than calling it
    // synchronously from inside the subscription itself.
    const minted: GraphOperation[] = []
    let placed:
      | ((scope: LinkScopeView, topology: LinkTopologyView) => void)
      | undefined
    const port = attachLinkMintPort({
      events: {
        onPlaced: (listener) => {
          placed = listener
          return () => {
            placed = undefined
          }
        },
        onDeleted: () => () => undefined
      },
      session: createMintSession(),
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations)
    })

    placed?.(ROOT_SCOPE, {
      id: 204,
      originNodeId: 1,
      originSlot: 0,
      targetNodeId: 2,
      targetSlot: REF_VIDEO_1_LIVE_INDEX,
      type: 'VIDEO'
    } satisfies LinkTopologyView)

    // Today's mint has no name lookup, so it mints whatever `to_slot` the
    // live topology handed it - exactly the value a mint-side, name-aware
    // fix would have to change (to `REF_VIDEO_1_DOC_INDEX`). It is
    // deliberately NOT pinned here: pinning it would make the outcome
    // assertion below unreachable by any fix that keeps this line green.
    expect(minted).toHaveLength(1)
    expect(minted[0]).toMatchObject({
      op: 'connect',
      link_id: 204,
      from_node: 1,
      from_slot: 0,
      to_node: 2,
      link_type: 'VIDEO'
    })

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

    // Correct outcome: the link the canvas drew onto
    // `ref_videos.ref_video_1` (VIDEO) lands on that named input, and the
    // unrelated `prompt` (STRING) input the live index collides with is
    // left untouched. On `main` the applier instead writes the link onto
    // `prompt` by raw position and leaves `ref_videos.ref_video_1` null -
    // these assertions are the ones that go red.
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
