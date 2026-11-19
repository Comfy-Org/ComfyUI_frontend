import { describe, expect, it } from 'vitest'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { widgetId } from '@comfyorg/graph-model/widgetId'

import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import {
  resolveInputValueSource,
  resolveInputValueSources
} from './resolveInputValueSource'

const rootId = '00000000-0000-4000-8000-000000000001'
const scope = graphScopeOf({ id: rootId, rootGraph: { id: rootId } })
const hostValue = widgetId(rootId, toNodeId(29), 'value')

function node(id: number, type: string, widgetName = 'value'): NodeState {
  const state: NodeState = {
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
  useNodeDataStore().registerNode(scope, state)
  useWidgetValueStore().registerWidget(widgetId(rootId, state.id, widgetName), {
    type: 'number',
    value: 37,
    options: {}
  })
  return state
}

function link(source: NodeState, target: NodeState) {
  useLinkStore().registerLink(scope, {
    id: toLinkId(Number(target.id) * 100 + Number(source.id)),
    graphId: scope.owningGraphId,
    originNodeId: source.id,
    originSlot: 0,
    targetNodeId: target.id,
    targetSlot: 0,
    type: 'INT'
  })
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
      link(source, reroute)
      link(reroute, downstream)
      link(downstream, host)
      link(branchingNode, other)

      expect(resolveInputValueSource(scope, host, 0, hostValue)).toEqual({
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
    expect(resolveInputValueSource(scope, host, 0, id)).toEqual({
      kind: 'editable',
      node: host,
      widgetId: id,
      shared: false
    })
  })

  it('edits the stored widget of a legacy PrimitiveNode', () => {
    const host = node(29, 'subgraph')
    const source = node(11, 'PrimitiveNode', 'seed')
    link(source, host)
    expect(resolveInputValueSource(scope, host, 0, hostValue)).toEqual({
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
    link(source, host)
    expect(resolveInputValueSource(scope, host, 0, hostValue)).toEqual({
      kind: 'linked',
      node: source
    })
  })

  it('terminates an upstream cycle without exposing an editable value', () => {
    const host = node(29, 'subgraph')
    const a = node(11, 'PrimitiveInt')
    const b = node(7, 'PrimitiveInt')
    link(a, host)
    link(b, a)
    link(a, b)
    expect(resolveInputValueSource(scope, host, 0, hostValue)).toEqual({
      kind: 'unavailable'
    })
  })

  it('resolves only the host inputs that carry a widget, keyed by input name', () => {
    const host = node(29, 'subgraph')
    host.inputs = [
      { ...host.inputs[0], name: 'image', widgetId: undefined },
      { ...host.inputs[0], name: 'steps', widgetId: hostValue }
    ]

    expect([...resolveInputValueSources(rootId, host)]).toEqual([
      [
        'steps',
        { kind: 'editable', node: host, widgetId: hostValue, shared: false }
      ]
    ])
  })
})
