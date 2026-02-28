import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  resolveConcretePromotedWidget,
  resolvePromotedWidgetAtHost
} from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
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

type PromotedWidgetStub = Pick<
  IBaseWidget,
  'name' | 'type' | 'options' | 'value' | 'y'
> & {
  sourceNodeId: string
  sourceWidgetName: string
  node?: SubgraphNode
}

function createHostNode(id: number): SubgraphNode {
  return createTestSubgraphNode(createTestSubgraph(), { id })
}

function addNodeToHost(host: SubgraphNode, title: string): LGraphNode {
  const node = new LGraphNode(title)
  host.subgraph.add(node)
  return node
}

function addConcreteWidget(node: LGraphNode, name: string): IBaseWidget {
  return node.addWidget('text', name, `${name}-value`, () => undefined)
}

function createPromotedWidget(
  name: string,
  sourceNodeId: string,
  sourceWidgetName: string,
  node?: SubgraphNode
): IBaseWidget {
  const promotedWidget: PromotedWidgetStub = {
    name,
    type: 'button',
    options: {},
    y: 0,
    value: undefined,
    sourceNodeId,
    sourceWidgetName,
    node
  }
  return promotedWidget as IBaseWidget
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('resolvePromotedWidgetAtHost', () => {
  test('resolves a direct concrete widget on the host subgraph node', () => {
    const host = createHostNode(100)
    const concreteNode = addNodeToHost(host, 'leaf')
    addConcreteWidget(concreteNode, 'seed')

    const resolved = resolvePromotedWidgetAtHost(
      host,
      String(concreteNode.id),
      'seed'
    )

    expect(resolved).toBeDefined()
    expect(resolved?.node.id).toBe(concreteNode.id)
    expect(resolved?.widget.name).toBe('seed')
  })

  test('returns undefined when host does not contain the target node', () => {
    const host = createHostNode(100)

    const resolved = resolvePromotedWidgetAtHost(host, 'missing', 'seed')

    expect(resolved).toBeUndefined()
  })
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

  test('descends through nested promoted widgets to resolve concrete source', () => {
    const rootHost = createHostNode(100)
    const nestedHost = createHostNode(101)
    const leafNode = addNodeToHost(nestedHost, 'leaf')
    addConcreteWidget(leafNode, 'seed')
    const sourceNode = addNodeToHost(rootHost, 'source')
    sourceNode.widgets = [
      createPromotedWidget('outer', String(leafNode.id), 'seed', nestedHost)
    ]

    const result = resolveConcretePromotedWidget(
      rootHost,
      String(sourceNode.id),
      'outer'
    )

    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.resolved.node.id).toBe(leafNode.id)
    expect(result.resolved.widget.name).toBe('seed')
  })

  test('returns cycle failure when promoted widgets form a loop', () => {
    const hostA = createHostNode(200)
    const hostB = createHostNode(201)
    const relayA = addNodeToHost(hostA, 'relayA')
    const relayB = addNodeToHost(hostB, 'relayB')

    relayA.widgets = [
      createPromotedWidget('wA', String(relayB.id), 'wB', hostB)
    ]
    relayB.widgets = [
      createPromotedWidget('wB', String(relayA.id), 'wA', hostA)
    ]

    const result = resolveConcretePromotedWidget(hostA, String(relayA.id), 'wA')

    expect(result).toEqual({
      status: 'failure',
      failure: 'cycle'
    })
  })

  test('does not report a cycle when different host objects share an id', () => {
    const rootHost = createHostNode(41)
    const nestedHost = createHostNode(41)
    const leafNode = addNodeToHost(nestedHost, 'leaf')
    addConcreteWidget(leafNode, 'w')
    const sourceNode = addNodeToHost(rootHost, 'source')
    sourceNode.widgets = [
      createPromotedWidget('w', String(leafNode.id), 'w', nestedHost)
    ]

    const result = resolveConcretePromotedWidget(
      rootHost,
      String(sourceNode.id),
      'w'
    )

    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return

    expect(result.resolved.node.id).toBe(leafNode.id)
    expect(result.resolved.widget.name).toBe('w')
  })

  test('returns max-depth-exceeded for very deep non-cyclic promoted chains', () => {
    const hosts = Array.from({ length: 102 }, (_, index) =>
      createHostNode(index + 1)
    )
    const relayNodes = hosts.map((host, index) =>
      addNodeToHost(host, `relay-${index}`)
    )

    for (let index = 0; index < relayNodes.length - 1; index += 1) {
      relayNodes[index].widgets = [
        createPromotedWidget(
          `w-${index}`,
          String(relayNodes[index + 1].id),
          `w-${index + 1}`,
          hosts[index + 1]
        )
      ]
    }

    addConcreteWidget(
      relayNodes[relayNodes.length - 1],
      `w-${relayNodes.length - 1}`
    )

    const result = resolveConcretePromotedWidget(
      hosts[0],
      String(relayNodes[0].id),
      'w-0'
    )

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
