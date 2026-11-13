import { describe, expect, it } from 'vitest'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import type { LinkTopology } from '@comfyorg/graph-model/linkTopology'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetState } from '@comfyorg/graph-model/widgetState'

import { resolveInputValueSource } from './resolveInputValueSource'
import type { ValueSourceGraph } from './resolveInputValueSource'

const rootId = '00000000-0000-4000-8000-000000000001'
const scope = graphScopeOf({ id: rootId, rootGraph: { id: rootId } })
const hostValue = widgetId(rootId, toNodeId(29), 'value')

function node(id: number, type: string): NodeState {
  return {
    id: toNodeId(id),
    graphId: rootId,
    type,
    title: type,
    flags: {},
    inputs: [
      {
        name: 'value',
        type: 'INT',
        widget: { name: 'value' },
        boundingRect: [0, 0, 0, 0]
      }
    ],
    outputs: [
      { name: 'INT', type: 'INT', links: [], boundingRect: [0, 0, 0, 0] }
    ],
    mode: LGraphEventMode.ALWAYS,
    properties: {}
  }
}

function link(source: NodeState, target: NodeState): LinkTopology {
  return {
    id: toLinkId(Number(target.id)),
    graphId: scope.owningGraphId,
    originNodeId: source.id,
    originSlot: 0,
    targetNodeId: target.id,
    targetSlot: 0,
    type: 'INT'
  }
}

function fixture(
  nodes: NodeState[],
  links: LinkTopology[] = [],
  widgetName = 'value'
): ValueSourceGraph {
  const widgets = new Map(
    nodes.map((node) => [
      widgetId(rootId, node.id, widgetName),
      {
        nodeId: node.id,
        name: widgetName,
        type: 'number',
        value: 37,
        y: 0,
        options: {}
      } satisfies WidgetState
    ])
  )
  return {
    nodes: new Map(nodes.map((node) => [node.id, node])),
    inputLink: (node, index) =>
      links.find(
        (link) => link.targetNodeId === node.id && link.targetSlot === index
      ),
    outputLinkCount: (node, index) =>
      links.filter(
        (link) => link.originNodeId === node.id && link.originSlot === index
      ).length,
    widgetIds: (node) => [widgetId(rootId, node.id, widgetName)],
    widget: (id) => widgets.get(id)
  }
}

describe('subgraph input value source', () => {
  it.for([
    { branch: 'no', shared: false },
    { branch: 'source', shared: true },
    { branch: 'reroute', shared: true },
    { branch: 'downstream Primitive', shared: true }
  ] as const)(
    'follows a Primitive chain and reroute to the owning widget when $branch node branches',
    ({ branch, shared }) => {
      const host = node(29, 'subgraph')
      const source = node(3, 'PrimitiveInt')
      const reroute = node(7, 'Reroute')
      const downstream = node(11, 'PrimitiveInt')
      const other = node(37, 'subgraph')
      const unrelated = node(41, 'PrimitiveInt')
      const branchingNode = {
        no: unrelated,
        source,
        reroute,
        'downstream Primitive': downstream
      }[branch]
      const graph = fixture(
        [host, source, reroute, downstream, other, unrelated],
        [
          link(source, reroute),
          link(reroute, downstream),
          link(downstream, host),
          link(branchingNode, other)
        ]
      )

      expect(resolveInputValueSource(graph, host, 0, hostValue)).toEqual({
        kind: 'editable',
        node: source,
        widgetId: widgetId(rootId, source.id, 'value'),
        shared
      })
    }
  )

  it('addresses an unconnected promoted input by its existing widget ID', () => {
    const host = node(29, 'subgraph')
    const id = widgetId(rootId, host.id, 'value')
    expect(resolveInputValueSource(fixture([host]), host, 0, id)).toEqual({
      kind: 'editable',
      node: host,
      widgetId: id,
      shared: false
    })
  })

  it('edits the stored widget of a legacy PrimitiveNode', () => {
    const host = node(29, 'subgraph')
    const source = node(11, 'PrimitiveNode')
    const graph = fixture([host, source], [link(source, host)], 'seed')
    expect(resolveInputValueSource(graph, host, 0, hostValue)).toEqual({
      kind: 'editable',
      node: source,
      widgetId: widgetId(rootId, source.id, 'seed'),
      shared: false
    })
  })

  it.for([
    {
      name: 'computed output',
      type: 'GetImageSize',
      mode: LGraphEventMode.ALWAYS
    },
    {
      name: 'muted Primitive',
      type: 'PrimitiveInt',
      mode: LGraphEventMode.NEVER
    },
    {
      name: 'bypassed Primitive',
      type: 'PrimitiveInt',
      mode: LGraphEventMode.BYPASS
    }
  ])('leaves $name read-only', ({ type, mode }) => {
    const host = node(29, 'subgraph')
    const source = node(11, type)
    source.mode = mode
    expect(
      resolveInputValueSource(
        fixture([host, source], [link(source, host)]),
        host,
        0,
        hostValue
      )
    ).toEqual({ kind: 'linked', node: source })
  })

  it('terminates an upstream cycle without exposing an editable value', () => {
    const host = node(29, 'subgraph')
    const a = node(11, 'PrimitiveInt')
    const b = node(7, 'PrimitiveInt')
    const graph = fixture([host, a, b], [link(a, host), link(b, a), link(a, b)])
    expect(resolveInputValueSource(graph, host, 0, hostValue)).toEqual({
      kind: 'unavailable'
    })
  })
})
