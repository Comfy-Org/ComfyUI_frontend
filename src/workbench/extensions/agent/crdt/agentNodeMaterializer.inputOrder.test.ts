import { linksMap, nodesMap } from '@comfyorg/comfy-multi-player'
import { expect, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { useLitegraphService } from '@/services/litegraphService'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { nodeDef, savedNode, singleImageNode } from './__fixtures__/inputOrder'
import { crdtTest } from './__fixtures__/crdtSession'
import type { CreateCrdtSession } from './__fixtures__/crdtSession'

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { canvas: undefined, isGraphReady: false, configuringGraph: false },
  ComfyApp: class {}
}))

const catalog = { types: {} }
const connections = [
  { id: 276, name: 'width', slot: 4, type: 'INT' },
  { id: 277, name: 'height', slot: 5, type: 'INT' },
  { id: 275, name: 'length', slot: 6, type: 'INT' },
  { id: 279, name: 'prompt', slot: 3, type: 'STRING' },
  { id: 278, name: 'ref_images.ref_image_0', slot: 0, type: 'IMAGE' },
  { id: 282, name: 'ref_images.ref_image_1', slot: 1, type: 'IMAGE' }
]

const source = {
  id: 1,
  type: 'ReferenceSources',
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
  seed: typeof savedNode | typeof singleImageNode = savedNode
) {
  LiteGraph.registerNodeType('ReferenceSources', LGraphNode)
  await useLitegraphService().registerNodeDef(nodeDef.name, nodeDef)
  const session = createCrdtSession({
    workflowId: 'input-order',
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
  'preserves named input targets and serialization without changing the shared document',
  async ({ createCrdtSession }) => {
    const { graph, host, follower, minted, deliver, targets } =
      await setup(createCrdtSession)
    const originalNode = nodesMap(host).get('2')?.toJSON()
    const originalLinks = linksMap(host).toJSON()
    deliver()

    expect(targets()).toEqual(connections.map(({ name }) => name))
    expect(nodesMap(follower.doc).get('2')?.toJSON()).toEqual(originalNode)
    expect(linksMap(follower.doc).toJSON()).toEqual(originalLinks)
    const saved = structuredClone(graph.serialize())
    const target = saved.nodes.find(({ id }) => String(id) === '2')!
    for (const { id, name } of connections) {
      expect(target.inputs?.find((input) => input.name === name)?.link).toBe(id)
    }
    expect(
      target.inputs?.find(({ name }) => name === 'ref_image_size')
    ).toMatchObject({
      type: 'COMBO',
      widget: { name: 'ref_image_size' }
    })
    expect(minted).toEqual([])

    graph.configure(saved)
    expect(targets()).toEqual(connections.map(({ name }) => name))
  }
)

function growImages(graph: LGraph) {
  const from = graph.getNodeById(toNodeId(1))!
  const to = graph.getNodeById(toNodeId(2))!
  const widthSlot = to.findInputSlot('width')
  expect(
    from.connect(4, to, to.findInputSlot('ref_images.ref_image_0'))
  ).toBeTruthy()
  expect(to.findInputSlot('ref_images.ref_image_1')).toBeGreaterThanOrEqual(0)
  expect(to.findInputSlot('width')).not.toBe(widthSlot)
  return { from, to }
}

crdtTest(
  'preserves named targets when an agent reconnect follows growth that moves width',
  async ({ createCrdtSession }) => {
    const { graph, minted, deliver, apply, targets } = await setup(
      createCrdtSession,
      singleImageNode
    )
    deliver()
    const names = targets()
    const { to } = growImages(graph)
    apply(minted)
    minted.length = 0
    deliver()
    const documentSlot = singleImageNode.inputs.findIndex(
      ({ name }) => name === 'width'
    )
    expect(to.findInputSlot('ref_images.ref_image_1')).toBeGreaterThanOrEqual(0)
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

    expect(to.getInputLink(to.findInputSlot('width'))?.id).toBe(900)
    expect(graph.getLink(toLinkId(276))).toBeUndefined()
    expect(targets().slice(1)).toEqual(names.slice(1))
    expect(to.findInputSlot('ref_images.ref_image_1')).toBeGreaterThanOrEqual(0)
    expect(minted).toEqual([])
  }
)

crdtTest(
  'mints the document index after growth moves width and preserves the reconnect on echo',
  async ({ createCrdtSession }) => {
    const { graph, minted, deliver, apply } = await setup(
      createCrdtSession,
      singleImageNode
    )
    deliver()
    const { from, to } = growImages(graph)
    apply(minted)
    minted.length = 0
    deliver()
    const documentSlot = singleImageNode.inputs.findIndex(
      ({ name }) => name === 'width'
    )
    expect(to.findInputSlot('width')).not.toBe(documentSlot)
    expect(to.findInputSlot('ref_images.ref_image_1')).toBeGreaterThanOrEqual(0)

    const link = from.connect(1, to, to.findInputSlot('width'))
    expect(link).toBeTruthy()
    expect(minted).toEqual([
      expect.objectContaining({ op: 'connect', to_slot: documentSlot })
    ])
    apply(minted)
    minted.length = 0
    deliver()
    expect(to.getInputLink(to.findInputSlot('width'))?.id).toBe(link?.id)
    const saved = graph.serialize().nodes.find(({ id }) => String(id) === '2')!
    expect(saved.inputs?.find(({ name }) => name === 'width')?.link).toBe(
      link?.id
    )
    expect(to.findInputSlot('ref_images.ref_image_1')).toBeGreaterThanOrEqual(0)
    expect(minted).toEqual([])
  }
)
