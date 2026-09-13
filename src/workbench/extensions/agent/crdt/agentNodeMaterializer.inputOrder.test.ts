import {
  applyOps,
  linksMap,
  mint,
  nodesMap
} from '@comfyorg/comfy-multi-player'
import { expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { nodeDef, savedNode, singleImageNode } from './__fixtures__/inputOrder'
import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { EcsFollowerAdapter, mapLocalInputSlots } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'
import { attachMintPortWiring } from './mintPortWiring'

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
  seed: typeof savedNode | typeof singleImageNode = savedNode
) {
  LiteGraph.registerNodeType('ReferenceSources', LGraphNode)
  await useLitegraphService().registerNodeDef(nodeDef.name, nodeDef)
  const graph = new LGraph()
  const previousGraph = app.rootGraph
  Reflect.set(app, 'rootGraph', graph)
  const minted: GraphOperation[] = []
  let sequence = 0
  const host = mint(
    {
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
  )
  const follower = new FollowerDoc()
  const adapter = new EcsFollowerAdapter(
    createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: () => {}, deleteNodes: () => {} }
    })
  )
  adapter.bind('input-order', follower)
  const wiring = attachMintPortWiring({
    isEnabled: () => true,
    isDocBound: () => true,
    enqueue: (operations) =>
      minted.push(...mapLocalInputSlots(follower.doc, graph, operations)),
    layoutChanges: () => () => {},
    localActorPrefix: 'user-',
    getGraph: () => graph
  })

  onTestFinished(() => {
    wiring.detach()
    adapter.destroy()
    follower.destroy()
    host.destroy()
    Reflect.set(app, 'rootGraph', previousGraph)
  })

  function deliver() {
    const update = Y.encodeStateAsUpdate(host, follower.stateVector())
    follower.applyRemoteUpdate(update)
    expect(
      adapter.applyFrame({ workflowId: 'input-order', seq: ++sequence, update })
    ).toBe(true)
    reconcileAgentAdapters(graph)
  }

  function apply(operations: GraphOperation[]) {
    const result = applyOps(
      host,
      operations.map((operation, index) => {
        const opId = `op-${sequence}-${index}`
        return {
          ...operation,
          op_id: opId,
          actor: 'agent:test',
          base_version: sequence,
          stamp: [sequence, 'agent:test']
        }
      }),
      catalog
    )
    expect(result.outcomes.every(({ outcome }) => outcome === 'applied')).toBe(
      true
    )
  }

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

it('preserves named input targets and serialization without changing the shared document', async () => {
  const { graph, host, follower, minted, deliver, targets } = await setup()
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
})

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

it('preserves named targets when an agent reconnect follows growth that moves width', async () => {
  const { graph, minted, deliver, apply, targets } =
    await setup(singleImageNode)
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
})

it('mints the document index after growth moves width and preserves the reconnect on echo', async () => {
  const { graph, minted, deliver, apply } = await setup(singleImageNode)
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
})
