import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

vi.mock(import('@/platform/telemetry/reportError'))

/**
 * The unique-name invariant removes a widget it cannot name uniquely. What
 * counts as "cannot" is the subject here, because the two candidate criteria
 * disagree on a node the user can reach:
 *
 * - **the read-back** — write `name#1`, read `name` back, remove on mismatch;
 * - **the descriptor** — remove only when `name` could not be written at all.
 *
 * `BaseWidget.set name` delegates to `widgetValueStore.renameWidget()` and
 * returns without changing `_name` whenever the store declines a move it owns.
 * So the read-back can report failure for a widget that is addressable in
 * principle, and removing on it destroys that widget.
 */
function reportedTypes(): (string | undefined)[] {
  return vi
    .mocked(reportError)
    .mock.calls.map((call) => call[1].errorType as string | undefined)
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
    vi.mocked(reportError).mockClear()
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

  it('does not let a duplicate rename move the entry the other widget registered', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const seed = node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})

    graph.remove(node)
    steps.name = 'seed'
    graph.add(node)

    // While the names collided, `steps` claimed `graphId:nodeId:seed`, which is
    // `seed`'s to hold: being handed that entry welds the pair onto one
    // `WidgetState` and destroys the second value.
    const store = useWidgetValueStore()
    expect(store.getWidget(widgetId(graph.id, node.id, 'seed'))?.value).toBe(1)
    expect(seed.widgetId).toBe(widgetId(graph.id, node.id, 'seed'))
    expect(steps.widgetId).toBe(widgetId(graph.id, node.id, 'seed#1'))
    expect(store.getWidget(widgetId(graph.id, node.id, 'seed#1'))?.value).toBe(
      2
    )
  })

  it('does not let a duplicate rename steal the entry of a widget on another node', () => {
    const graph = new LGraph()
    const store = useWidgetValueStore()

    // Node A holds an ordinary, legitimately registered `seed`. Nothing about
    // node A is ambiguous and nothing below is node A's doing.
    const nodeA = new LGraphNode('a')
    graph.add(nodeA)
    const aSeed = nodeA.addWidget('number', 'seed', 7, () => undefined, {})

    const nodeB = new LGraphNode('b')
    graph.add(nodeB)
    nodeB.addWidget('number', 'seed', 1, () => undefined, {})
    const victim = nodeB.addWidget('number', 'steps', 2, () => undefined, {})

    // A `_state.nodeId` left pointing at a node the widget no longer belongs
    // to. Set directly rather than driven through widget adoption, which is
    // what produces it in production; the stale binding is the precondition
    // under test, not the route to it.
    const state = (victim as unknown as { _state: { nodeId: unknown } })._state
    state.nodeId = nodeA.id

    graph.remove(nodeB)
    victim.name = 'seed'
    graph.add(nodeB)

    // Node B carrying a duplicate name must not reach into node A. Renaming
    // `victim` targets `graphId:A:seed` — node A's widget's id, because
    // identity is `graphId:nodeId:name` and both parts are now borrowed. Moving
    // that entry deletes node A's registration and hands node A's value to a
    // widget on node B.
    expect(store.getWidget(widgetId(graph.id, nodeA.id, 'seed'))?.value).toBe(7)
    expect(
      store.getWidget(widgetId(graph.id, nodeA.id, 'seed#1'))
    ).toBeUndefined()
    expect(aSeed.value).toBe(7)
    expect(victim.value).toBe(2)
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
    const slot = {
      name: 'steps',
      type: 'number',
      _widget: steps,
      widget: { name: 'steps' },
      pos: [0, 0]
    } as unknown as (typeof node.inputs)[number]
    node.inputs.push(slot)

    graph.remove(node)
    steps.name = 'seed'
    graph.add(node)

    // The teardown that a removal owes the node is wrong for a widget the node
    // still has: it would call `onRemove` on a live widget and drop the slot's
    // back-references, leaving an input pointing at nothing.
    expect(removals).toBe(0)
    expect(slot._widget).toBe(steps)
    expect(slot.widget).toBeDefined()
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

    // Nothing can address this one, so keeping it would silently share the
    // other widget's value. Removal is correct here and is not weakened.
    expect(node.widgets).not.toContain(doomed)
    expect(reportedTypes()).toContain('failure_renaming_widget_duplicate_name')
  })
})
