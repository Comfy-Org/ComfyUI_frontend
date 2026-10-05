import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

vi.mock(import('@/platform/telemetry/reportError'))

function reportedTypes(): (string | undefined)[] {
  return vi.mocked(reportError).mock.calls.map((call) => call[1].errorType)
}

function names(node: LGraphNode): string[] {
  return (node.widgets ?? []).map((widget) => widget.name)
}

function storedNames(graph: LGraph, node: LGraphNode): string[] {
  return useWidgetValueStore()
    .getNodeWidgets(graph.id, node.id)
    .map((widget) => widget.name)
}

describe('unique-name refusal criterion', () => {
  beforeEach(() => {
    LiteGraph.vueNodesMode = false
  })

  it('resolves an ordinary renamable duplicate on a node that was removed and re-added', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const seed = node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})

    expect(storedNames(graph, node)).toEqual(['seed', 'steps'])

    // Deletes the store entries and leaves `_state.nodeId` set.
    graph.remove(node)

    steps.name = 'seed'
    expect(steps.name).toBe('seed')

    // Undo and paste both land here.
    graph.add(node)

    expect(node.widgets).toContain(seed)
    expect(node.widgets).toContain(steps)
    expect(names(node)).toEqual(['seed', 'seed#1'])
    expect(storedNames(graph, node)).toEqual(['seed', 'seed#1'])
    expect(reportedTypes()).toEqual([])

    expect(seed.value).toBe(1)
    expect(steps.value).toBe(2)

    seed.value = 111
    steps.value = 222
    expect(seed.value).toBe(111)
    expect(steps.value).toBe(222)
  })

  it('does not let a duplicate rename steal the entry of a widget on another node', () => {
    const graph = new LGraph()
    const store = useWidgetValueStore()

    const nodeA = new LGraphNode('a')
    graph.add(nodeA)
    const aSeed = nodeA.addWidget('number', 'seed', 7, () => undefined, {})
    nodeA.addWidget('number', 'steps', 8, () => undefined, {})

    const nodeB = new LGraphNode('b')
    graph.add(nodeB)
    nodeB.addWidget('number', 'seed', 1, () => undefined, {})
    const victim = nodeB.addWidget('number', 'steps', 2, () => undefined, {})

    assert(victim instanceof BaseWidget)
    victim.bindRegisteredState(nodeA.id)

    graph.remove(nodeB)
    victim.name = 'seed'
    graph.add(nodeB)

    expect(store.getWidget(widgetId(graph.id, nodeA.id, 'seed'))?.value).toBe(7)
    expect(
      store.getWidget(widgetId(graph.id, nodeA.id, 'seed#1'))
    ).toBeUndefined()
    expect(aSeed.value).toBe(7)
  })

  it('reports an unresolved pair once, not on every later commit', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})

    // Writable, so the widget must not be removed, and no candidate the walk
    // offers can ever stick.
    Object.defineProperty(steps, 'name', {
      get: () => 'seed',
      set: () => undefined,
      configurable: true
    })

    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(node.widgets).toContain(steps)
    expect(reportedTypes()).toEqual(['failure_resolving_widget_duplicate_name'])

    // Re-found by every later commit, and `reportError` has no dedupe of its
    // own, so this would otherwise warn for the rest of the session.
    node.addWidget('number', 'denoise', 4, () => undefined, {})
    node.widgets?.push(
      node.addWidget('number', 'guidance', 5, () => undefined, {})
    )

    expect(reportedTypes()).toEqual(['failure_resolving_widget_duplicate_name'])

    const cfg = node.widgets?.find((widget) => widget.name === 'cfg')
    assert.exists(cfg)
    Object.defineProperty(cfg, 'name', {
      get: () => 'seed',
      set: () => undefined,
      configurable: true
    })
    node.addWidget('number', 'eta', 6, () => undefined, {})

    expect(reportedTypes()).toEqual([
      'failure_resolving_widget_duplicate_name',
      'failure_resolving_widget_duplicate_name'
    ])
  })

  it('renames past a candidate a stale store entry still holds', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const stale = node.addWidget('number', 'seed#1', 2, () => undefined, {})
    Object.defineProperty(stale, 'name', {
      value: 'other',
      writable: true,
      configurable: true
    })

    const added = node.addWidget('number', 'seed', 3, () => undefined, {})

    expect(names(node)).toEqual(['seed', 'other', 'seed#2'])
    expect(added.value).toBe(3)
  })

  it('leaves a kept duplicate wired up, rather than tearing it down in place', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})
    let removals = 0
    steps.onRemove = () => {
      removals++
    }
    const slot = node.addInput('steps', 'number')
    slot._widget = steps
    slot.widget = { name: 'steps' }
    Object.defineProperty(steps, 'name', {
      get: () => 'seed',
      set: () => undefined,
      configurable: true
    })

    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(node.widgets).toContain(steps)
    expect(removals).toBe(0)
    expect(slot._widget).toBe(steps)
    expect(slot.widget).toEqual({ name: 'steps' })
  })

  it('still removes a duplicate whose name genuinely cannot be written', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const doomed = node.addWidget('number', 'steps', 2, () => undefined, {})
    Object.defineProperty(doomed, 'name', {
      value: 'seed',
      writable: false,
      configurable: false,
      enumerable: true
    })

    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(node.widgets).not.toContain(doomed)
    expect(reportedTypes()).toContain('failure_renaming_widget_duplicate_name')
  })
})
