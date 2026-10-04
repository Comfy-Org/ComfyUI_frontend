import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '../subgraph/__fixtures__/subgraphHelpers'

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

  it('renames rather than refuses a raw pushed duplicate, which normalization makes renamable', () => {
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

    // Renamability is judged after `toConcreteWidget`, which gives a raw
    // object the concrete class's writable `name` accessor. Judging it while
    // still raw would delete a widget that renames cleanly a line later, and
    // refusal is permanent.
    expect(names(node)).toEqual(['seed', 'seed#1'])
    expect(storedNames(node)).toEqual(['seed', 'seed#1'])
    expect(reportError).not.toHaveBeenCalled()
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

  it('leaves names alone while the node is detached, and settles them on add', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('number', 'audio', 1, () => undefined, {})
    node.addWidget('button', 'audio', '', () => undefined, {})

    // No `WidgetId` exists before the node has a graph, so there is nothing to
    // collide over yet — and renaming during construction is observable:
    // `litegraphService` finds the widget a custom constructor just made by
    // comparing `candidate.name` to the returned widget's name, so an early
    // rename moves the input's label onto the wrong widget. Core's RecordAudio
    // node builds exactly this shape.
    expect(names(node)).toEqual(['audio', 'audio'])

    graph.add(node)

    expect(names(node)).toEqual(['audio', 'audio#1'])
    expect(storedNames(node)).toEqual(['audio', 'audio#1'])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a widget whose name throws without letting the throw escape the commit', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const hostile = node.addWidget('number', 'steps', 2, () => undefined, {})
    Object.defineProperty(hostile, 'name', {
      get(): string {
        throw new Error('name is not readable')
      },
      configurable: false
    })

    // The report runs after the array has already been spliced, so re-reading
    // the accessor there would leave the node's widgets and the store's order
    // out of sync — with the error surfacing far from its cause.
    expect(() =>
      node.addWidget('number', 'cfg', 3, () => undefined, {})
    ).not.toThrow()

    expect(names(node)).toEqual(['seed', 'cfg'])
    // Its own cause, not the duplicate one: this widget has no duplicate, and
    // an alert that says it does sends the reader hunting for a collision.
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'widget_unreadable_name_refused',
        context: expect.objectContaining({ widgetName: undefined })
      })
    )
  })

  it('refuses a raw pushed widget whose name throws instead of wedging the node', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})

    // `BaseWidget`'s constructor reads the source object's `name`, so
    // converting this throws out of the commit before the refusal can see it —
    // and out of every later commit too, which is what wedges the node.
    const hostile = {
      get name(): string {
        throw new Error('name is not readable')
      },
      type: 'number',
      value: 2,
      y: 0,
      options: {}
    }

    expect(() => node.widgets!.push(hostile as never)).not.toThrow()
    // `indexOf` rather than `not.toContain`: the matcher deep-compares, which
    // reads the getter and throws out of the assertion itself.
    expect(node.widgets!.indexOf(hostile as never)).toBe(-1)

    // The node still takes widgets afterwards, and the store's order keeps up.
    expect(() =>
      node.addWidget('number', 'steps', 3, () => undefined, {})
    ).not.toThrow()
    expect(names(node)).toEqual(['seed', 'steps'])
    expect(storedNames(node)).toEqual(['seed', 'steps'])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'widget_unreadable_name_refused'
      })
    )
  })

  it('clears slot back-references to a widget it refused', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const second = node.addWidget('number', 'steps', 2, () => undefined, {})
    node.addInput('steps', 'INT')
    const input = node.inputs.at(-1)!
    input._widget = second
    input.widget = { name: 'steps' }
    pinName(second, 'seed')

    node.addWidget('number', 'cfg', 3, () => undefined, {})

    // Refusal splices the widget straight out of the array, so the teardown
    // `removeWidget` owns has to happen here or the node keeps pointing at a
    // widget it no longer has.
    expect(node.widgets).not.toContain(second)
    expect(input._widget).toBeUndefined()
    expect(input.widget).toBeUndefined()
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

  it('does not report a refusal it cannot carry out on a subgraph node', () => {
    // A `SubgraphNode` rebuilds `widgets` on every read, so nothing this
    // module splices ever leaves the node. Enforcing there anyway reports the
    // alerting contract `widget_duplicate_name_refused` for a refusal that did
    // not happen — and promoted projections have a getter-only `name`, so a
    // node promoting the same inner widget name twice hits it on every add.
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'first', type: 'INT' },
        { name: 'second', type: 'INT' }
      ]
    })
    const host = createTestSubgraphNode(subgraph)
    const store = useWidgetValueStore()
    const rootGraphId = host.rootGraph.id

    for (const [slot, sourceNodeId] of [
      [0, 900],
      [1, 901]
    ] as const) {
      const id = widgetId(rootGraphId, toNodeId(sourceNodeId), 'seed')
      store.registerWidget(id, { type: 'number', value: slot, options: {} })
      host.inputs[slot].widgetId = id
    }

    expect(host.widgets.map((widget) => widget.name)).toEqual(['seed', 'seed'])

    host.rootGraph.add(host)

    // Still both there: this node class is outside the invariant's reach, and
    // that is the pre-existing behaviour the refusal must not pretend to change.
    expect(host.widgets.map((widget) => widget.name)).toEqual(['seed', 'seed'])
    expect(reportError).not.toHaveBeenCalled()
  })
})
