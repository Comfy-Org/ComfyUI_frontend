import { fromPartial } from '@total-typescript/shoehorn'
import { assert, expect, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type * as AppModule from '@/scripts/app'
import type { ComfyApp } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import {
  nodeDef,
  savedNode,
  singleReferenceNode
} from './__fixtures__/multiAutogrowInputOrder'
import { crdtTest } from './__fixtures__/crdtSession'
import type { CreateCrdtSession } from './__fixtures__/crdtSession'

vi.mock(import('@/scripts/app'), () =>
  fromPartial<typeof AppModule>({
    app: fromPartial<ComfyApp>({
      canvas: undefined,
      isGraphReady: false,
      configuringGraph: false
    }),
    ComfyApp: class {}
  })
)

const catalog = { types: {} }
// Origin slots come from this array's order; target slots are resolved by
// name against the seed's saved inputs. Two autogrow groups (ref_images,
// ref_videos) are both grown and both linked, so their growth interleaves
// with the scalar widgets on reload -- the shape a single autogrow group
// never has to reproduce.
const connections = [
  { id: 276, name: 'width', type: 'INT' },
  { id: 277, name: 'height', type: 'INT' },
  { id: 275, name: 'length', type: 'INT' },
  { id: 279, name: 'prompt', type: 'STRING' },
  { id: 285, name: 'ref_image_size', type: 'COMBO' },
  { id: 278, name: 'ref_images.ref_image_0', type: 'IMAGE' },
  { id: 282, name: 'ref_images.ref_image_1', type: 'IMAGE' },
  { id: 283, name: 'ref_videos.ref_video_0', type: 'VIDEO' },
  { id: 284, name: 'ref_videos.ref_video_1', type: 'VIDEO' }
]

const source = {
  id: 1,
  type: 'MultiReferenceSources',
  pos: [0, 0],
  size: [200, 200],
  flags: {},
  order: 0,
  mode: 0,
  inputs: [],
  outputs: connections.map(({ id, name, type }) => ({
    name,
    type,
    links: [id]
  }))
} satisfies ISerialisedNode

async function setup(
  createCrdtSession: CreateCrdtSession,
  seed: typeof savedNode | typeof singleReferenceNode = savedNode
) {
  LiteGraph.registerNodeType('MultiReferenceSources', LGraphNode)
  await useLitegraphService().registerNodeDef(nodeDef.name, nodeDef)
  const session = createCrdtSession({
    workflowId: 'multi-autogrow-input-order',
    seed: {
      nodes: structuredClone([
        {
          ...source,
          outputs: source.outputs.map((output, index) => ({
            ...output,
            links: seed.inputs.some(
              (input) => input.link === connections[index].id
            )
              ? output.links
              : []
          }))
        },
        seed
      ]),
      links: connections.flatMap(({ id, name, type }, originSlot) => {
        const slot = seed.inputs.findIndex(
          (input) => input.name === name && input.link === id
        )
        return slot < 0 ? [] : [[id, 1, originSlot, 2, slot, type]]
      })
    },
    catalog
  })
  const { graph, host, follower, minted, deliver, applyAgent: apply } = session

  function targets() {
    return connections
      .filter(({ id }) => seed.inputs.some((input) => input.link === id))
      .map(({ id }) => {
        const link = graph.getLink(toLinkId(id))
        return link
          ? graph.getNodeById(link.target_id)?.inputs[link.target_slot]?.name
          : undefined
      })
  }

  return { graph, host, follower, minted, deliver, apply, targets }
}

crdtTest(
  'preserves named input targets across two interleaved autogrow groups on reload',
  async ({ createCrdtSession }) => {
    const { graph, targets, deliver } = await setup(createCrdtSession)
    deliver()

    // Every saved link must land back on the input it was named for, even
    // though two autogrow groups (ref_images, ref_videos) both grew and both
    // moved every scalar widget after them.
    expect(targets()).toEqual(connections.map(({ name }) => name))

    const saved = structuredClone(graph.serialize())
    graph.configure(saved)
    expect(targets()).toEqual(connections.map(({ name }) => name))
  }
)

crdtTest(
  "keeps each named input's connected state correct at its actual live " +
    'index, even though interleaved autogrow growth does not preserve the ' +
    "document's input order",
  async ({ createCrdtSession }) => {
    const { graph, deliver } = await setup(createCrdtSession)
    deliver()

    const to = graph.getNodeById(toNodeId(2))
    assert(to)
    const scope = graphScopeOf(graph)
    const linkStore = useLinkStore()

    const connectedState = savedNode.inputs.map((input) => {
      const slot = to.findInputSlot(input.name)
      return {
        name: input.name,
        present: slot >= 0,
        connected: linkStore.isInputSlotConnected(scope, toNodeId(2), slot)
      }
    })
    expect(connectedState).toEqual(
      savedNode.inputs.map((input) => ({
        name: input.name,
        present: true,
        connected: input.link !== null
      }))
    )
  }
)

function growImages(graph: LGraph) {
  const from = graph.getNodeById(toNodeId(1))
  const to = graph.getNodeById(toNodeId(2))
  assert(from)
  assert(to)
  const widthSlot = to.findInputSlot('width')
  expect(
    from.connect(5, to, to.findInputSlot('ref_images.ref_image_0'))
  ).toBeTruthy()
  expect(to.findInputSlot('ref_images.ref_image_1')).toBeGreaterThanOrEqual(0)
  expect(to.findInputSlot('width')).not.toBe(widthSlot)
  return { from, to }
}

crdtTest(
  'preserves named targets when an agent reconnect follows growth, with a second autogrow group also present on the node',
  async ({ createCrdtSession }) => {
    const { graph, minted, deliver, apply, targets } = await setup(
      createCrdtSession,
      singleReferenceNode
    )
    deliver()
    const names = targets()
    // ref_videos is present (min-grown to one slot) but never touched by this
    // test: its mere presence between ref_images and the scalars is what a
    // single-autogrow-group fixture cannot reproduce.
    const to = graph.getNodeById(toNodeId(2))
    assert(to)
    expect(to.findInputSlot('ref_videos.ref_video_0')).toBeGreaterThanOrEqual(0)

    growImages(graph)
    apply(minted)
    minted.length = 0
    deliver()

    const documentSlot = singleReferenceNode.inputs.findIndex(
      ({ name }) => name === 'width'
    )
    expect(to.findInputSlot('ref_images.ref_image_1')).toBeGreaterThanOrEqual(0)
    expect(to.findInputSlot('ref_videos.ref_video_0')).toBeGreaterThanOrEqual(0)
    expect(to.findInputSlot('width')).not.toBe(documentSlot)

    apply([
      {
        op: 'connect',
        link_id: 900,
        from_node: 1,
        from_slot: 1,
        to_node: 2,
        to_slot: documentSlot,
        link_type: 'INT'
      }
    ])
    deliver()

    // The agent submitted a connect for the document's "width" slot index.
    // It must land on the live width input, not on whatever slot growth of
    // the second group happened to leave at that index.
    expect(to.getInputLink(to.findInputSlot('width'))?.id).toBe(900)
    expect(graph.getLink(toLinkId(276))).toBeUndefined()
    expect(targets().slice(1)).toEqual(names.slice(1))
    expect(to.findInputSlot('ref_images.ref_image_1')).toBeGreaterThanOrEqual(0)
    expect(to.findInputSlot('ref_videos.ref_video_0')).toBeGreaterThanOrEqual(0)
    expect(minted).toEqual([])
  }
)
