import {
  applyOps,
  linksMap,
  mint,
  nodesMap
} from '@comfyorg/comfy-multi-player'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { minimaxNode, minimaxNodeDef } from './__fixtures__/minimaxReference'
import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'
import { attachMintPortWiring } from './mintPortWiring'
import type { MintPortWiring } from './mintPortWiring'

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { canvas: undefined, isGraphReady: false, configuringGraph: false },
  ComfyApp: class {}
}))

const catalog = { types: {} }
const connections = [
  { id: 276, name: 'width', slot: 10, type: 'INT' },
  { id: 277, name: 'height', slot: 11, type: 'INT' },
  { id: 275, name: 'length', slot: 12, type: 'INT' },
  { id: 279, name: 'prompt', slot: 9, type: 'STRING' },
  { id: 278, name: 'ref_images.ref_image_0', slot: 3, type: 'IMAGE' },
  { id: 282, name: 'ref_images.ref_image_1', slot: 4, type: 'IMAGE' }
]

const source = {
  id: 115,
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

let graph: LGraph
let host: Y.Doc
let follower: FollowerDoc
let adapter: EcsFollowerAdapter
let wiring: MintPortWiring
let minted: GraphOperation[]
let sequence: number

beforeEach(async () => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('ReferenceSources', LGraphNode)
  await useLitegraphService().registerNodeDef(
    minimaxNodeDef.name,
    minimaxNodeDef
  )
  graph = new LGraph()
  Reflect.set(app, 'rootGraph', graph)
  minted = []
  sequence = 0
  host = mint(
    {
      nodes: structuredClone([source, minimaxNode]),
      links: connections.map(({ id, slot, type }, originSlot) => [
        id,
        115,
        originSlot,
        136,
        slot,
        type
      ])
    },
    catalog
  )
  follower = new FollowerDoc()
  adapter = new EcsFollowerAdapter(
    createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: () => {}, deleteNodes: () => {} }
    })
  )
  adapter.bind('minimax', follower)
  wiring = attachMintPortWiring({
    isEnabled: () => true,
    isDocBound: () => true,
    enqueue: (operations) => minted.push(...operations),
    layoutChanges: () => () => {},
    localActorPrefix: 'user-',
    getGraph: () => graph
  })
})

afterEach(() => {
  wiring.detach()
  adapter.destroy()
  follower.destroy()
  host.destroy()
  LiteGraph.unregisterNodeType('ReferenceSources')
  LiteGraph.unregisterNodeType(minimaxNodeDef.name)
})

function deliver() {
  const update = Y.encodeStateAsUpdate(host, follower.stateVector())
  follower.applyRemoteUpdate(update)
  expect(
    adapter.applyFrame({ workflowId: 'minimax', seq: ++sequence, update })
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
  return connections.map(({ id }) => {
    const link = graph.getLink(toLinkId(id))!
    return graph.getNodeById(link.target_id)?.inputs[link.target_slot]?.name
  })
}

it('preserves MiniMax template targets and serialization without changing the shared document', () => {
  const originalNode = nodesMap(host).get('136')?.toJSON()
  const originalLinks = linksMap(host).toJSON()
  deliver()

  expect(targets()).toEqual(connections.map(({ name }) => name))
  expect(nodesMap(follower.doc).get('136')?.toJSON()).toEqual(originalNode)
  expect(linksMap(follower.doc).toJSON()).toEqual(originalLinks)
  const saved = structuredClone(graph.serialize())
  const target = saved.nodes.find(({ id }) => String(id) === '136')!
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

  wiring.detach()
  graph.configure(saved)
  expect(targets()).toEqual(connections.map(({ name }) => name))
})

it('keeps every named target when a later agent connect replaces one resolution wire', () => {
  deliver()
  apply([
    {
      op: 'connect',
      link_id: 276,
      from_node: 115,
      from_slot: 1,
      to_node: 136,
      to_slot: 10,
      link_type: 'INT'
    }
  ])
  deliver()

  expect(targets()).toEqual(connections.map(({ name }) => name))
  expect(graph.getLink(toLinkId(276))?.origin_slot).toBe(1)
  expect(minted).toEqual([])
})

it('mints a local reconnect using the shared input index and keeps it after the agent echo', () => {
  deliver()
  const from = graph.getNodeById(toNodeId(115))!
  const to = graph.getNodeById(toNodeId(136))!
  const link = from.connect(1, to, to.findInputSlot('width'))
  expect(link).toBeTruthy()
  expect(minted).toEqual([
    expect.objectContaining({
      op: 'connect',
      from_slot: 1,
      to_slot: 10
    })
  ])

  apply(minted)
  minted.length = 0
  deliver()
  expect(graph.getNodeById(toNodeId(136))?.getInputLink(10)?.id).toBe(link?.id)
  expect(graph.getNodeById(toNodeId(136))?.inputs[10]?.name).toBe('width')
  expect(minted).toEqual([])
})
