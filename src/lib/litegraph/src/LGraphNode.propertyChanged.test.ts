import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LGraphEventMap } from './infrastructure/LGraphEventMap'
import { LGraph, LGraphNode } from './litegraph'
import { LGraphEventMode, RenderShape } from './types/globalEnums'

type PropertyChange = LGraphEventMap['node:property:changed']

/**
 * Subscribes to the events the node itself produces. Nothing here fabricates a
 * `node:property:changed` event — the assertions only see what `LGraphNode`
 * dispatches through its graph.
 */
function observe(graph: LGraph) {
  const changes: PropertyChange[] = []
  graph.events.addEventListener('node:property:changed', (e) => {
    changes.push(e.detail)
  })
  return changes
}

function attachedNode() {
  const graph = new LGraph()
  const node = new LGraphNode('Test Node')
  graph.add(node)
  return { graph, node }
}

describe('LGraphNode shell-state change events', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('announces every tracked shell field with its before and after value', () => {
    const { graph, node } = attachedNode()
    const changes = observe(graph)

    node.title = 'New Title'
    node.mode = LGraphEventMode.NEVER
    node.color = '#123456'
    node.bgcolor = '#654321'
    node.shape = 'round'
    node.showAdvanced = true

    expect(changes).toEqual([
      {
        nodeId: node.id,
        property: 'title',
        oldValue: 'Test Node',
        newValue: 'New Title'
      },
      {
        nodeId: node.id,
        property: 'mode',
        oldValue: LGraphEventMode.ALWAYS,
        newValue: LGraphEventMode.NEVER
      },
      {
        nodeId: node.id,
        property: 'color',
        oldValue: undefined,
        newValue: '#123456'
      },
      {
        nodeId: node.id,
        property: 'bgcolor',
        oldValue: undefined,
        newValue: '#654321'
      },
      {
        nodeId: node.id,
        property: 'shape',
        oldValue: undefined,
        newValue: RenderShape.ROUND
      },
      {
        nodeId: node.id,
        property: 'showAdvanced',
        oldValue: undefined,
        newValue: true
      }
    ])
  })

  it('stays silent when a write does not change the value', () => {
    const { graph, node } = attachedNode()
    const changes = observe(graph)

    node.title = 'Renamed'
    node.title = 'Renamed'

    expect(changes).toHaveLength(1)
  })

  it('still writes through when the node has no graph to announce on', () => {
    const detached = new LGraphNode('Orphan')

    expect(() => {
      detached.title = 'Renamed'
    }).not.toThrow()
    expect(detached.title).toBe('Renamed')
  })

  it('does not announce flag changes, including collapse', () => {
    // Characterizes a deliberate ECS migration divergence from main.
    const { graph, node } = attachedNode()
    const changes = observe(graph)

    node.flags.collapsed = true
    node.collapse(true)
    node.flags.pinned = true

    expect(node.collapsed).toBe(false)
    expect(changes).toEqual([])
  })
})

describe('LGraphNode flag serialization', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('serializes a set flag, including false, and omits an unset one', () => {
    const { node } = attachedNode()

    expect(node.serialize().flags).toEqual({})

    node.flags.collapsed = true
    expect(node.serialize().flags).toEqual({ collapsed: true })

    node.flags.collapsed = false
    expect(node.serialize().flags).toEqual({ collapsed: false })

    node.flags.collapsed = undefined
    expect(Object.keys(node.serialize().flags)).toEqual([])
  })

  it('keeps a cleared flag as an enumerable own key on the live node', () => {
    // Characterizes a deliberate ECS migration divergence from main.
    const { node } = attachedNode()

    node.flags.collapsed = true
    node.flags.collapsed = undefined

    expect(Object.keys(node.flags)).toEqual(['collapsed'])
  })
})
