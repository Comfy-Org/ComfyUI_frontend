import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

vi.mock(import('@/platform/telemetry/reportError'))

/**
 * Two widgets on one node cannot share a name: `WidgetId` is
 * `graphId:nodeId:name`, so the second is the same identity, not a second one.
 * ADR-ECS-0008, "Widget identity keys on `name`".
 *
 * `ensureUniqueWidgetNames` keeps that true by renaming the repeat to
 * `name#1`. It cannot rename a widget whose `name` is not writable, and it
 * then leaves every name unchanged — the one state in which a node really
 * carries an ambiguous pair. These cases pin the refusal that replaces it.
 */

function createNode(): LGraphNode {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  graph.add(node)
  return node
}

/**
 * Pins `name` on an already-concrete widget, which is how the state is
 * actually reached: an extension redefines the property in `onNodeCreated`
 * after the widget exists. A non-writable descriptor on the *plain* object
 * handed to `addWidget` does not survive — `toConcreteWidget` merges the
 * concrete class's writable accessor over it.
 */
function pinName(widget: IBaseWidget, name: string): void {
  Object.defineProperty(widget, 'name', {
    value: name,
    writable: false,
    configurable: false,
    enumerable: true
  })
}

function names(node: LGraphNode): string[] {
  return (node.widgets ?? []).map((widget) => widget.name)
}

function storedNames(node: LGraphNode): string[] {
  return useWidgetValueStore()
    .getNodeWidgets(node.graph!.rootGraph.id, node.id)
    .map((widget) => widget.name)
}

describe('unique widget name invariant', () => {
  beforeEach(() => {
    LiteGraph.vueNodesMode = false
    vi.mocked(reportError).mockClear()
  })

  it('still renames a duplicate it can rename, and reports nothing', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.addWidget('number', 'seed', 2, () => undefined, {})

    expect(names(node)).toEqual(['seed', 'seed#1'])
    expect(storedNames(node)).toEqual(['seed', 'seed#1'])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('refuses the duplicate it cannot rename and reports a stable error type', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const second = node.addWidget('number', 'steps', 2, () => undefined, {})
    pinName(second, 'seed')

    // A name pinned after the widget exists is caught by the next widgets
    // mutation; `LGraph.add` is also one, which is what covers the realistic
    // `onNodeCreated` case the next test pins.
    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(names(node)).toEqual(['seed', 'cfg'])
    expect(node.widgets).not.toContain(second)
    // The error type is spelled out rather than compared to the exported
    // constant: an alert query is written against this string, so renaming it
    // is the breaking change and the literal is the contract.
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'widget_duplicate_name_refused',
        surface: 'graph'
      })
    )
  })

  it('does not let a refused widget overwrite the stored value of the one that kept the name', () => {
    const node = createNode()
    const first = node.addWidget('number', 'seed', 1, () => undefined, {})
    const moved = node.addWidget('number', 'steps', 2, () => undefined, {})
    node.widgets!.splice(node.widgets!.indexOf(moved), 1)
    pinName(moved, 'seed')

    // Refused inside the add itself, so the add must not go on to register it:
    // the id it would register under is the one `first` already holds, and
    // registering binds the refused widget's state to that entry.
    node.addCustomWidget(moved)
    moved.value = 99

    expect(names(node)).toEqual(['seed'])
    expect(first.value).toBe(1)
    expect(
      useWidgetValueStore().getWidget(
        widgetId(node.graph!.rootGraph.id, node.id, 'seed')
      )?.value
    ).toBe(1)
  })

  it('refuses a pinned duplicate installed before the node joins a graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('custom', 'duplicate', 'first', () => undefined, {})
    const second = node.addWidget('custom', 'second', 'second', () => {}, {})
    pinName(second, 'duplicate')

    graph.add(node)

    expect(names(node)).toEqual(['duplicate'])
    expect(storedNames(node)).toEqual(['duplicate'])
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('registers the widget that kept the name, which an ambiguous pair blocked', () => {
    const node = createNode()
    const first = node.addWidget('number', 'seed', 1, () => undefined, {})
    const second = node.addWidget('number', 'steps', 2, () => undefined, {})
    pinName(second, 'seed')
    node.addWidget('number', 'cfg', 3, () => undefined, {})

    const store = useWidgetValueStore()
    const id = widgetId(node.graph!.rootGraph.id, node.id, 'seed')
    expect(store.getWidget(id)?.value).toBe(1)

    first.value = 7
    expect(store.getWidget(id)?.value).toBe(7)
  })

  it('leaves the kept widget untouched when the refused one is written to', () => {
    const node = createNode()
    const first = node.addWidget('number', 'seed', 1, () => undefined, {})
    const second = node.addWidget('number', 'steps', 2, () => undefined, {})
    pinName(second, 'seed')
    node.addWidget('number', 'cfg', 3, () => undefined, {})

    second.value = 99

    expect(first.value).toBe(1)
    expect(
      useWidgetValueStore().getWidget(
        widgetId(node.graph!.rootGraph.id, node.id, 'seed')
      )?.value
    ).toBe(1)
  })

  it('settles a renamable collision the refusal was masking', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.addWidget('number', 'steps', 2, () => undefined, {})
    const third = node.addWidget('number', 'spare', 3, () => undefined, {})
    pinName(third, 'seed')

    // `ensureUniqueWidgetNames` is all-or-nothing, so this renamable repeat
    // only stays ambiguous while the unrenamable one is on the node.
    node.addWidget('number', 'steps', 4, () => undefined, {})

    expect(names(node)).toEqual(['seed', 'steps', 'steps#1'])
    expect(storedNames(node)).toEqual(['seed', 'steps', 'steps#1'])
  })

  it('refuses a pinned duplicate pushed in raw, not only one added through addWidget', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const raw: IBaseWidget = {
      name: 'placeholder',
      type: 'legacy_test',
      value: 5,
      options: {},
      y: 0
    }
    pinName(raw, 'seed')

    node.widgets!.push(raw)

    expect(names(node)).toEqual(['seed'])
    expect(storedNames(node)).toEqual(['seed'])
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('refuses the later of a pinned pair carried in by a whole-array assignment', () => {
    const node = createNode()
    const kept = node.addWidget('number', 'seed', 1, () => undefined, {})
    const other = node.addWidget('number', 'steps', 2, () => undefined, {})
    pinName(other, 'seed')

    // Node packs rebuild the array wholesale rather than adding one at a time.
    node.widgets = undefined
    node.widgets = [kept, other]

    expect(node.widgets).toEqual([kept])
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('does not refuse one widget object occupying two slots mid-reorder', () => {
    const node = createNode()
    const first = node.addWidget('number', 'a', 1, () => undefined, {})
    const secondWidget = node.addWidget('number', 'b', 2, () => undefined, {})

    node.widgets![1] = first
    node.widgets![0] = secondWidget

    expect(names(node)).toEqual(['b', 'a'])
    expect(reportError).not.toHaveBeenCalled()
  })
})
