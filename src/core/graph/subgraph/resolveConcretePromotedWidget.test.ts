import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { LGraphNode, asNodeId } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({ widgetStates: new Map() })
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

function createHostNode(id: number): SubgraphNode {
  return createTestSubgraphNode(createTestSubgraph(), { id: asNodeId(id) })
}

function addNodeToHost(host: SubgraphNode, title: string): LGraphNode {
  const node = new LGraphNode(title)
  host.subgraph.add(node)
  return node
}

function addConcreteWidget(node: LGraphNode, name: string): IBaseWidget {
  return node.addWidget('text', name, `${name}-value`, () => undefined)
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('resolveConcretePromotedWidget', () => {
  test('resolves a direct concrete source widget', () => {
    const host = createHostNode(100)
    const concreteNode = addNodeToHost(host, 'leaf')
    addConcreteWidget(concreteNode, 'seed')

    const result = resolveConcretePromotedWidget(
      host,
      String(concreteNode.id),
      'seed'
    )

    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.resolved.node.id).toBe(concreteNode.id)
    expect(result.resolved.widget.name).toBe('seed')
  })

  test('descends through nested subgraph inputs to the deepest concrete widget', () => {
    const innerSubgraph = createTestSubgraph({
      inputs: [{ name: 'x', type: '*' }]
    })
    const leaf = new LGraphNode('Leaf')
    const leafInput = leaf.addInput('x', '*')
    leaf.addWidget('combo', 'seed', 'a', () => undefined, {
      values: ['a', 'b']
    })
    leafInput.widget = { name: 'seed' }
    innerSubgraph.add(leaf)
    innerSubgraph.inputNode.slots[0].connect(leafInput, leaf)

    const innerNode = createTestSubgraphNode(innerSubgraph, {
      id: asNodeId(11)
    })

    const outerSubgraph = createTestSubgraph({
      inputs: [{ name: 'y', type: '*' }]
    })
    outerSubgraph.add(innerNode)
    innerNode._internalConfigureAfterSlots()
    outerSubgraph.inputNode.slots[0].connect(innerNode.inputs[0], innerNode)

    const outerNode = createTestSubgraphNode(outerSubgraph, {
      id: asNodeId(22)
    })

    const result = resolveConcretePromotedWidget(
      outerNode,
      String(innerNode.id),
      'x'
    )

    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.resolved.node.id).toBe(leaf.id)
    expect(result.resolved.widget.name).toBe('seed')
    expect(result.resolved.widget.type).toBe('combo')
  })

  test('returns cycle when nested promoted widget traversal revisits the same input', () => {
    const recursiveInput = { name: 'x', link: 1 }
    const recursiveNode = fromAny<LGraphNode, unknown>({
      id: 11,
      inputs: [recursiveInput],
      isSubgraphNode: () => true,
      subgraph: {
        inputNode: { slots: [{ name: 'x', linkIds: [1] }] },
        getLink: () => ({
          resolve: () => ({ inputNode: recursiveNode })
        }),
        getNodeById: () => recursiveNode
      }
    })
    const host = fromAny<SubgraphNode, unknown>({
      isSubgraphNode: () => true,
      subgraph: {
        getNodeById: () => recursiveNode
      }
    })

    const result = resolveConcretePromotedWidget(host, '11', 'x')

    expect(result).toEqual({ status: 'failure', failure: 'cycle' })
  })

  test('returns max-depth-exceeded for a chain over the traversal limit', () => {
    const subgraphs = Array.from({ length: 102 }, () =>
      createTestSubgraph({ inputs: [{ name: 'x', type: '*' }] })
    )

    for (let index = 0; index < subgraphs.length - 1; index++) {
      const current = subgraphs[index]
      const next = subgraphs[index + 1]
      const nextNode = createTestSubgraphNode(next, { id: asNodeId(index + 1) })
      current.add(nextNode)
      nextNode._internalConfigureAfterSlots()
      current.inputNode.slots[0].connect(nextNode.inputs[0], nextNode)
    }

    const host = createTestSubgraphNode(subgraphs[0], { id: asNodeId(200) })

    const result = resolveConcretePromotedWidget(host, '1', 'x')
    expect(result).toEqual({
      status: 'failure',
      failure: 'max-depth-exceeded'
    })
  })

  test('returns invalid-host for non-subgraph host node', () => {
    const host = new LGraphNode('plain-host')

    const result = resolveConcretePromotedWidget(host, 'x', 'y')

    expect(result).toEqual({
      status: 'failure',
      failure: 'invalid-host'
    })
  })

  test('returns missing-node when source node does not exist in host subgraph', () => {
    const host = createHostNode(100)

    const result = resolveConcretePromotedWidget(host, 'missing-node', 'seed')

    expect(result).toEqual({
      status: 'failure',
      failure: 'missing-node'
    })
  })

  test('returns missing-widget when source node exists but widget cannot be resolved', () => {
    const host = createHostNode(100)
    const sourceNode = addNodeToHost(host, 'source')
    sourceNode.widgets = []

    const result = resolveConcretePromotedWidget(
      host,
      String(sourceNode.id),
      'missing-widget'
    )

    expect(result).toEqual({
      status: 'failure',
      failure: 'missing-widget'
    })
  })
})
