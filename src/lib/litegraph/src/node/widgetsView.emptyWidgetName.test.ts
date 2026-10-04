import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

vi.mock(import('@/platform/telemetry/reportError'))

/**
 * An empty widget name is not an ambiguous one, and the unique-name invariant
 * must leave it alone in both directions.
 *
 * `widgetId` mints `graphId:nodeId:` for it, which `isWidgetId` rejects and
 * `widgetValueStore.registerWidget` declines to key on. Declining an id is the
 * whole cost: the widget stays on the node, renders, fires its callback and
 * serializes. The two ways of "fixing" that are both worse and both have been
 * written at least once:
 *
 * - **Refusing it** deletes a working widget and shifts every positional
 *   `widgets_values` slot after it. `browser_tests/tests/vueNodes/widgets/emptyNameWidget.spec.ts`
 *   is the user-visible pin (#13773: rgthree Power Lora Loader rendered no
 *   widgets at all), and these cases are the unit-level one.
 * - **Renaming it apart** — to `#1` — relabels an ordinary unlabeled widget
 *   that no other widget collides with. `addWidget('text', '', …)` is a shape
 *   node packs ship deliberately.
 *
 * Both are pinned here because the array-level assertions in
 * `widgetId.test.ts` compare live widget objects, so a rename passes them.
 */

function createNode(): LGraphNode {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  graph.add(node)
  return node
}

function names(node: LGraphNode): string[] {
  return (node.widgets ?? []).map((widget) => widget.name)
}

function storedNames(node: LGraphNode): string[] {
  return useWidgetValueStore()
    .getNodeWidgets(node.graph!.rootGraph.id, node.id)
    .map((widget) => widget.name)
}

describe('empty widget name', () => {
  beforeEach(() => {
    LiteGraph.vueNodesMode = false
    vi.mocked(reportError).mockClear()
  })

  it('keeps an unlabeled widget on the node, under the name it was given', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.addWidget('text', '', 'hello', () => undefined, {})
    node.addWidget('number', 'cfg', 3, () => undefined, {})

    // Still on the node, and still unlabeled. Asserting the name rather than
    // only the array is what separates "kept" from "kept but relabeled `#1`".
    expect(names(node)).toEqual(['seed', '', 'cfg'])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('declines the un-keyable id without withholding one from its siblings', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.addWidget('text', '', 'hello', () => undefined, {})
    node.addWidget('number', 'cfg', 3, () => undefined, {})

    // The store declines `graphId:nodeId:` and keeps every other widget. The
    // failure this guards against is the whole node going unregistered
    // because one widget could not be keyed.
    expect(storedNames(node)).toEqual(['seed', 'cfg'])
  })

  it('keeps the value an unlabeled widget holds, rather than losing it to the store', () => {
    const node = createNode()
    const unlabeled = node.addWidget('text', '', 'hello', () => undefined, {})

    // An unregistered widget reads and writes its own local state. If this
    // regressed, the widget would render but forget what the user typed.
    unlabeled.value = 'typed'
    expect(unlabeled.value).toBe('typed')
  })

  it('still settles two unlabeled widgets, which do collide with each other', () => {
    const node = createNode()
    node.addWidget('text', '', 'first', () => undefined, {})
    node.addWidget('text', '', 'second', () => undefined, {})

    // Two empty names are one identity twice, so the invariant applies as it
    // does to any other duplicate — the second is renamed, not refused.
    expect(names(node)).toEqual(['', '#1'])
    expect(node.widgets).toHaveLength(2)
    expect(reportError).not.toHaveBeenCalled()
  })
})
