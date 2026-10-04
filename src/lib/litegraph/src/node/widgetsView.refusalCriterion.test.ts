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

    graph.remove(node)

    steps.name = 'seed'
    expect(steps.name).toBe('seed')

    graph.add(node)

    expect(node.widgets).toContain(seed)
    expect(node.widgets).toContain(steps)
    expect(names(node)).toEqual(['seed', 'seed#1'])
    expect(storedNames(graph, node)).toEqual(['seed', 'seed#1'])
    // It is still reported, so the pair is observable rather than tolerated in
    // silence — under its own `errorType`, because nothing was lost.
    expect(reportedTypes()).toEqual([
      'failure_resolving_widget_duplicate_name'
    ])
    expect(reportedTypes()).not.toContain('widget_duplicate_name_refused')

    // Keeping the pair must not be paid for with a *value* either, which the
    // widget array's length cannot show. One widget holds the name and keeps
    // the identity; the duplicate gets no id at all, so it cannot be handed
    // that entry and the two stay independent — rather than both resolving to
    // one store entry under the shared name.
    const store = useWidgetValueStore()
    expect(
      store.getNodeWidgets(graph.id, node.id).map(({ name }) => name)
    ).toEqual(['seed'])
    expect(store.getWidget(widgetId(graph.id, node.id, 'seed'))?.value).toBe(1)
    expect(steps.widgetId).toBeUndefined()
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
    graph.add(node)

    // The node's widget order is what a Vue node renders from
    // (`getNodeWidgetIds` in `LGraphNode.vue`), so a node with no order draws
    // no widgets. Registration was gated on `ensureUniqueWidgetNames`, whose
    // verdict is whole-node: one pair that could not be renamed apart made
    // *every* widget here bail, including `cfg`, which collides with nothing.
    // Three widgets on the node, an empty order, and nothing drawn — the same
    // visible loss the keep-rather-remove criterion exists to prevent.
    const store = useWidgetValueStore()
    expect(store.getNodeWidgetIds(graph.id, node.id)).toEqual([
      widgetId(graph.id, node.id, 'seed'),
      widgetId(graph.id, node.id, 'cfg')
    ])

    // And the ambiguity is still contained: the duplicate has no identity, so
    // it cannot be registered under the name the other widget holds, and all
    // three widgets keep their own value.
    expect(steps.widgetId).toBeUndefined()
    expect(node.widgets).toHaveLength(3)
    expect(seed.value).toBe(1)
    expect(steps.value).toBe(2)
    expect(cfg.value).toBe(3)
  })

  it('does not let a duplicate rename move the entry the other widget registered', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const seed = node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})

    graph.remove(node)
    steps.name = 'seed'
    graph.add(node)

    // `graphId:nodeId:seed` is `seed`'s to hold: it is the widget that holds
    // the name first, so it is the one that registers. A rename of `steps`
    // must not move that entry — being handed it is what welded the pair onto
    // one `WidgetState` and destroyed the second value.
    const store = useWidgetValueStore()
    expect(store.getWidget(widgetId(graph.id, node.id, 'seed'))?.value).toBe(1)

    // The write is declined rather than silently redirected, so the name the
    // walk could not resolve is still ambiguous and still reported as such.
    steps.name = 'seed#1'
    expect(
      store.getWidget(widgetId(graph.id, node.id, 'seed#1'))
    ).toBeUndefined()
    expect(seed.value).toBe(1)
    expect(steps.value).toBe(2)
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
