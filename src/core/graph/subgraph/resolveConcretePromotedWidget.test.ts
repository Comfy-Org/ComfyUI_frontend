import { describe, expect, test } from 'vitest'

import {
  resolveConcretePromotedWidget,
  resolvePromotedWidgetAtHost,
  resolvePromotedWidgetLookupTarget
} from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

type MockGraphNode = {
  id: string
  widgets?: IBaseWidget[]
  subgraph?: MockSubgraph
  isSubgraphNode: () => boolean
}

type MockSubgraph = {
  inputNode: { slots: Array<{ name: string; linkIds: number[] }> }
  getNodeById: (id: string) => MockGraphNode | undefined
  getLink: (_id: number) => undefined
}

function createSubgraphNode(id: string): MockGraphNode {
  const nodeMap = new Map<string, MockGraphNode>()
  const subgraph: MockSubgraph = {
    inputNode: { slots: [] },
    getNodeById(nodeId: string) {
      return nodeMap.get(nodeId)
    },
    getLink() {
      return undefined
    }
  }

  const node: MockGraphNode = {
    id,
    subgraph,
    isSubgraphNode() {
      return true
    }
  }

  nodeMap.set(id, node)
  return node
}

function createRegularNode(
  id: string,
  widgets: IBaseWidget[] = []
): MockGraphNode {
  return {
    id,
    widgets,
    isSubgraphNode() {
      return false
    }
  }
}

function addNodeToHost(host: MockGraphNode, node: MockGraphNode): void {
  const nodeMap = new Map<string, MockGraphNode>()
  const originalGetNodeById = host.subgraph?.getNodeById
  if (!host.subgraph || !originalGetNodeById) return

  for (const key of [host.id, node.id]) {
    const existing = originalGetNodeById(key)
    if (existing) nodeMap.set(key, existing)
  }

  nodeMap.set(node.id, node)

  host.subgraph.getNodeById = (id: string) => nodeMap.get(id)
}

function createConcreteWidget(name: string): IBaseWidget {
  return {
    name,
    type: 'text',
    options: {},
    y: 0,
    value: `${name}-value`
  } as unknown as IBaseWidget
}

function createPromotedWidget(
  name: string,
  sourceNodeId: string,
  sourceWidgetName: string,
  node?: MockGraphNode
): IBaseWidget {
  return {
    name,
    type: 'button',
    options: {},
    y: 0,
    sourceNodeId,
    sourceWidgetName,
    node
  } as unknown as IBaseWidget
}

function asGraphNode(node: MockGraphNode): LGraphNode {
  return node as unknown as LGraphNode
}

function asSubgraphNode(node: MockGraphNode): SubgraphNode {
  return node as unknown as SubgraphNode
}

describe('resolvePromotedWidgetAtHost', () => {
  test('resolves a direct concrete widget on the host subgraph node', () => {
    const host = createSubgraphNode('host')
    const concreteNode = createRegularNode('leaf', [
      createConcreteWidget('seed')
    ])
    addNodeToHost(host, concreteNode)

    const resolved = resolvePromotedWidgetAtHost(
      asSubgraphNode(host),
      'leaf',
      'seed'
    )

    expect(resolved).toBeDefined()
    expect(resolved?.node.id).toBe('leaf')
    expect(resolved?.widget.name).toBe('seed')
  })

  test('returns undefined when host does not contain the target node', () => {
    const host = createSubgraphNode('host')

    const resolved = resolvePromotedWidgetAtHost(
      asSubgraphNode(host),
      'missing',
      'seed'
    )

    expect(resolved).toBeUndefined()
  })
})

describe('resolvePromotedWidgetLookupTarget', () => {
  test('returns direct concrete target for a non-promoted source widget', () => {
    const host = createSubgraphNode('host')
    const concreteNode = createRegularNode('leaf', [
      createConcreteWidget('seed')
    ])
    addNodeToHost(host, concreteNode)

    const target = resolvePromotedWidgetLookupTarget(
      asSubgraphNode(host),
      'leaf',
      'seed'
    )

    expect(target).toEqual({ nodeId: 'leaf', widgetName: 'seed' })
  })

  test('follows nested promoted chain and returns deepest concrete target', () => {
    const rootHost = createSubgraphNode('root')
    const nestedHost = createSubgraphNode('nested')
    const leafNode = createRegularNode('leaf', [createConcreteWidget('seed')])
    addNodeToHost(nestedHost, leafNode)

    nestedHost.widgets = [
      createPromotedWidget('outerWidget', 'leaf', 'seed', nestedHost)
    ]
    addNodeToHost(rootHost, nestedHost)

    const target = resolvePromotedWidgetLookupTarget(
      asSubgraphNode(rootHost),
      'nested',
      'outerWidget'
    )

    expect(target).toEqual({ nodeId: 'leaf', widgetName: 'seed' })
  })

  test('returns current lookup target when a promoted chain cycles', () => {
    const hostA = createSubgraphNode('hostA')
    const hostB = createSubgraphNode('hostB')

    hostA.widgets = [createPromotedWidget('wA', 'hostB', 'wB', hostB)]
    hostB.widgets = [createPromotedWidget('wB', 'hostA', 'wA', hostA)]

    addNodeToHost(hostA, hostB)
    addNodeToHost(hostB, hostA)

    const target = resolvePromotedWidgetLookupTarget(
      asSubgraphNode(hostA),
      'hostA',
      'wA'
    )

    expect(target).toEqual({ nodeId: 'hostA', widgetName: 'wA' })
  })
})

describe('resolveConcretePromotedWidget', () => {
  test('resolves a direct concrete source widget', () => {
    const host = createSubgraphNode('host')
    const concreteNode = createRegularNode('leaf', [
      createConcreteWidget('seed')
    ])
    addNodeToHost(host, concreteNode)

    const result = resolveConcretePromotedWidget(
      asGraphNode(host),
      'leaf',
      'seed'
    )

    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.resolved.node.id).toBe('leaf')
    expect(result.resolved.widget.name).toBe('seed')
  })

  test('descends through nested promoted widgets to resolve concrete source', () => {
    const rootHost = createSubgraphNode('root')
    const nestedHost = createSubgraphNode('nested')
    const leafNode = createRegularNode('leaf', [createConcreteWidget('seed')])
    addNodeToHost(nestedHost, leafNode)

    nestedHost.widgets = [
      createPromotedWidget('outer', 'leaf', 'seed', nestedHost)
    ]
    addNodeToHost(rootHost, nestedHost)

    const result = resolveConcretePromotedWidget(
      asGraphNode(rootHost),
      'nested',
      'outer'
    )

    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.resolved.node.id).toBe('leaf')
    expect(result.resolved.widget.name).toBe('seed')
  })

  test('returns cycle failure when promoted widgets form a loop', () => {
    const hostA = createSubgraphNode('hostA')
    const hostB = createSubgraphNode('hostB')

    hostA.widgets = [createPromotedWidget('wA', 'hostB', 'wB', hostB)]
    hostB.widgets = [createPromotedWidget('wB', 'hostA', 'wA', hostA)]

    addNodeToHost(hostA, hostB)
    addNodeToHost(hostB, hostA)

    const result = resolveConcretePromotedWidget(
      asGraphNode(hostA),
      'hostA',
      'wA'
    )

    expect(result).toEqual({
      status: 'failure',
      failure: 'cycle'
    })
  })

  test('returns max-depth-exceeded for very deep non-cyclic promoted chains', () => {
    const hosts: MockGraphNode[] = Array.from({ length: 102 }, (_, index) =>
      createSubgraphNode(`host-${index}`)
    )

    for (let index = 0; index < hosts.length - 1; index += 1) {
      const currentHost = hosts[index]
      const nextHost = hosts[index + 1]
      currentHost.widgets = [
        createPromotedWidget(
          `w-${index}`,
          `host-${index + 1}`,
          `w-${index + 1}`,
          nextHost
        )
      ]
      addNodeToHost(currentHost, nextHost)
    }

    hosts[hosts.length - 1].widgets = [
      createConcreteWidget(`w-${hosts.length - 1}`)
    ]

    const result = resolveConcretePromotedWidget(
      asGraphNode(hosts[0]),
      'host-0',
      'w-0'
    )

    expect(result).toEqual({
      status: 'failure',
      failure: 'max-depth-exceeded'
    })
  })

  test('returns invalid-host for non-subgraph host node', () => {
    const host = createRegularNode('plain-host')

    const result = resolveConcretePromotedWidget(asGraphNode(host), 'x', 'y')

    expect(result).toEqual({
      status: 'failure',
      failure: 'invalid-host'
    })
  })

  test('returns missing-node when source node does not exist in host subgraph', () => {
    const host = createSubgraphNode('host')

    const result = resolveConcretePromotedWidget(
      asGraphNode(host),
      'missing-node',
      'seed'
    )

    expect(result).toEqual({
      status: 'failure',
      failure: 'missing-node'
    })
  })

  test('returns missing-widget when source node exists but widget cannot be resolved', () => {
    const host = createSubgraphNode('host')
    const sourceNode = createRegularNode('source', [])
    addNodeToHost(host, sourceNode)

    const result = resolveConcretePromotedWidget(
      asGraphNode(host),
      'source',
      'missing-widget'
    )

    expect(result).toEqual({
      status: 'failure',
      failure: 'missing-widget'
    })
  })
})
