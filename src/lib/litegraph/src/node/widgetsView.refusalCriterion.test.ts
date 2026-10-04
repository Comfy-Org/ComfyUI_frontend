import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

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
 * returns without changing `_name` whenever the store declines, which it does
 * when the node has no entries. So the read-back reports failure for an
 * ordinary, fully renamable widget, and removing on it destroys that widget.
 */
function reportedTypes(): (string | undefined)[] {
  return vi
    .mocked(reportError)
    .mock.calls.map((call) => call[1].errorType as string | undefined)
}

describe('unique-name refusal criterion', () => {
  beforeEach(() => {
    LiteGraph.vueNodesMode = false
    vi.mocked(reportError).mockClear()
  })

  it('keeps an ordinary renamable duplicate on a node that was removed and re-added', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const seed = node.addWidget('number', 'seed', 1, () => undefined, {})
    const steps = node.addWidget('number', 'steps', 2, () => undefined, {})

    // Both registered, so each widget's `_state` is the store's object and
    // carries `nodeId`.
    expect(
      useWidgetValueStore()
        .getNodeWidgets(graph.id, node.id)
        .map((widget) => widget.name)
    ).toEqual(['seed', 'steps'])

    // Node removal runs `clearNodeOwnedStoreState`, deleting the store
    // entries. Nothing resets `_state.nodeId` on the widgets, so the next
    // rename attempt asks the store to move an entry that is no longer there.
    graph.remove(node)

    // Off-graph, so `BaseWidget.set name` takes its `!graphId` path and the
    // write lands. This is an ordinary duplicate-name state, reachable by an
    // extension renaming a widget while the node is detached.
    steps.name = 'seed'
    expect(steps.name).toBe('seed')

    // Re-adding commits `node.widgets`, which runs the refusal walk. Undoing a
    // node deletion and pasting a cut node both land here.
    graph.add(node)

    // The invariant must not pay for itself with a widget. Both are writable,
    // so neither is unaddressable and neither may be removed.
    expect(node.widgets).toContain(seed)
    expect(node.widgets).toContain(steps)
    expect(node.widgets).toHaveLength(2)

    // It is still reported, so the pair is observable rather than tolerated in
    // silence — under its own `errorType`, because nothing was lost.
    expect(reportedTypes()).toEqual(['widget_duplicate_name_unresolved'])
    expect(reportedTypes()).not.toContain('widget_duplicate_name_refused')
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
    expect(reportedTypes()).toContain('widget_duplicate_name_refused')
  })
})
