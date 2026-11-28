import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@comfyorg/graph-model/widgetId'

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

function ignoreNameWrites(widget: { name: string }, name: string): void {
  Object.defineProperty(widget, 'name', {
    get: () => name,
    set: () => undefined,
    configurable: true
  })
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

    graph.remove(node)

    steps.name = 'seed'
    expect(steps.name).toBe('seed')

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

  it('does not erase the whole widget order over one pair it cannot resolve', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const seed = node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})
    const cfg = node.addWidget('number', 'cfg', 3, () => undefined, {})

    graph.remove(node)
    steps.name = 'seed'
    ignoreNameWrites(steps, 'seed')
    graph.add(node)

    const store = useWidgetValueStore()
    expect(store.getNodeWidgetIds(graph.id, node.id)).toEqual([
      widgetId(graph.id, node.id, 'seed'),
      widgetId(graph.id, node.id, 'cfg')
    ])

    expect(node.widgets).toHaveLength(3)
    expect(seed.value).toBe(1)
    expect(steps.value).toBe(2)
    expect(cfg.value).toBe(3)
  })

  it('resolves the pair when a reorder moves which widget holds the name', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const seed = node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})

    graph.remove(node)
    steps.name = 'seed'
    ignoreNameWrites(steps, 'seed')
    graph.add(node)

    const store = useWidgetValueStore()
    expect(store.getWidget(widgetId(graph.id, node.id, 'seed'))?.value).toBe(1)

    node.widgets = [steps, seed]

    expect((node.widgets ?? []).map(({ name }) => name)).toEqual([
      'seed',
      'seed#1'
    ])
    expect(seed.value).toBe(1)
    expect(steps.value).toBe(2)

    steps.value = 222
    expect(seed.value).toBe(1)
    expect(store.getWidget(widgetId(graph.id, node.id, 'seed'))?.value).toBe(
      222
    )
    expect(store.getWidget(widgetId(graph.id, node.id, 'seed#1'))?.value).toBe(
      1
    )
  })

  it('still answers with its own entry id once it is spliced off the node', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const seed = node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})

    graph.remove(node)
    steps.name = 'seed'
    ignoreNameWrites(steps, 'seed')
    graph.add(node)

    node.widgets = (node.widgets ?? []).filter((widget) => widget !== seed)

    const id = widgetId(graph.id, node.id, 'seed')
    expect(seed.widgetId).toBe(id)

    const store = useWidgetValueStore()
    store.deleteWidget(id)
    expect(store.getWidget(id)).toBeUndefined()
    expect(steps.value).toBe(2)
  })

  it('gives no id to a refused duplicate, which never registered one', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const first = node.addWidget('number', 'seed', 1, () => undefined, {})
    const refused = node.addWidget('number', 'steps', 2, () => undefined, {})
    Object.defineProperty(refused, 'name', {
      value: 'seed',
      writable: false,
      configurable: false,
      enumerable: true
    })
    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(node.widgets).not.toContain(refused)

    expect(refused.widgetId).toBeUndefined()
    expect(first.widgetId).toBe(widgetId(graph.id, node.id, 'seed'))
  })

  it('does not let a kept duplicate adopt the entry of a widget spliced off the node', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const seed = node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})

    graph.remove(node)
    steps.name = 'seed'
    ignoreNameWrites(steps, 'seed')
    graph.add(node)

    node.widgets = (node.widgets ?? []).filter((widget) => widget !== seed)

    const store = useWidgetValueStore()
    expect(steps.widgetId).toBeUndefined()
    expect(store.getNodeWidgetIds(graph.id, node.id)).toEqual([])
    expect(steps.value).toBe(2)
    expect(seed.value).toBe(1)

    steps.value = 222
    expect(seed.value).toBe(1)
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

    Object.defineProperty(steps, 'name', {
      get: () => 'seed',
      set: () => undefined,
      configurable: true
    })

    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(node.widgets).toContain(steps)
    expect(reportedTypes()).toEqual(['failure_resolving_widget_duplicate_name'])

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
