import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isNodeBindable } from '@/lib/litegraph/src/utils/type'
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
        errorType: 'failure_renaming_widget_duplicate_name',
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

    // Everything the report reads off a refused widget is hostile by then, so
    // `type` is poisoned too: the report runs after the array has been
    // spliced, and a throw there would leave the node's widgets and the
    // store's order out of sync, surfacing far from its cause.
    Object.defineProperty(hostile, 'type', {
      get(): string {
        throw new Error('type is not readable either')
      },
      configurable: false
    })

    expect(() =>
      node.addWidget('number', 'cfg', 3, () => undefined, {})
    ).not.toThrow()

    expect(names(node)).toEqual(['seed', 'cfg'])
    // Its own cause, not the duplicate one: this widget has no duplicate, and
    // an alert that says it does sends the reader hunting for a collision.
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_reading_widget_name',
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
        errorType: 'failure_reading_widget_name'
      })
    )
  })

  it('reports the cause the walk decided, not the one a later read suggests', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const flaky = node.addWidget('number', 'steps', 2, () => undefined, {})

    // Unreadable for as long as the widget is on the node, readable once it
    // has been dropped. The walk therefore decides "unreadable"; anything that
    // asks the accessor again afterwards — the refusal reports after the
    // splice — gets a name back and would call it a duplicate instead.
    Object.defineProperty(flaky, 'name', {
      get(): string {
        if (node.widgets?.includes(flaky))
          throw new Error('name is not readable')
        return 'seed'
      },
      configurable: true
    })

    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(node.widgets!.indexOf(flaky)).toBe(-1)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_reading_widget_name'
      })
    )
  })

  it('does not swallow a conversion failure the refusal would not take', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})

    // Conversion reads `type` as well as `name`. This widget's name is
    // perfectly readable, so the refusal has no reason to drop it — letting
    // the conversion failure pass would leave a raw widget on the node and in
    // the store's order with nothing having reported it.
    const hostile = {
      name: 'steps',
      get type(): string {
        throw new Error('type is not readable')
      },
      value: 2,
      y: 0,
      options: {}
    }

    expect(() => node.widgets!.push(hostile as never)).toThrow(
      'type is not readable'
    )
    expect(reportError).not.toHaveBeenCalled()
  })

  it('clears a slot bound to the refused widget by name, which is how real nodes bind', () => {
    // The existing case sets `input._widget` by hand, and production assigns
    // that only for promoted subgraph inputs — the one class this refusal is
    // gated off. Ordinary nodes bind widget inputs by name, so a refusal that
    // only matches the direct reference clears nothing and the slot silently
    // re-binds to the widget that kept the name.
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const second = node.addWidget('number', 'steps', 2, () => undefined, {})
    node.addInput('steps', 'INT')
    const input = node.inputs.at(-1)!
    input.widget = { name: 'steps' }
    pinName(second, 'steps')

    // A second widget pinned onto `steps` is refused, and the slot that named
    // it must not be left pointing at a name it no longer owns.
    const third = node.addWidget('number', 'spare', 3, () => undefined, {})
    pinName(third, 'steps')
    node.addWidget('number', 'cfg', 4, () => undefined, {})

    expect(node.widgets!.indexOf(third)).toBe(-1)
    expect(input.widget).toBeUndefined()
  })

  it('does not tear down every input when a hole reaches the refusal', () => {
    // A nullish entry reads as an unreadable name and is refused like anything
    // else. Matching the teardown on it would clear every input whose
    // `_widget` is still unset, which is nearly all of them.
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.addInput('seed', 'INT')
    const input = node.inputs.at(-1)!
    input.widget = { name: 'seed' }

    expect(() => node.widgets!.push(undefined as never)).not.toThrow()

    expect(input.widget).toEqual({ name: 'seed' })
    expect(names(node)).toEqual(['seed'])
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

  it('reports a refused widget whose own teardown throws', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const second = node.addWidget('number', 'steps', 2, () => undefined, {})
    second.onRemove = () => {
      throw new Error('teardown blew up')
    }
    pinName(second, 'seed')

    // Teardown stopping half-done leaves a DOM widget's element mounted and
    // extension resources undisposed, so it needs a sink rather than a log.
    expect(() =>
      node.addWidget('number', 'cfg', 3, () => undefined, {})
    ).not.toThrow()

    expect(
      vi.mocked(reportError).mock.calls.map(([, options]) => options.errorType)
    ).toEqual([
      'failure_tearing_down_refused_widget',
      'failure_renaming_widget_duplicate_name'
    ])
  })

  it('leaves a node alone once it stops exposing the widget list this module owns', () => {
    // The node committed widgets through the view, then something replaced
    // `widgets` with its own getter — which is what `SubgraphNode` does, and
    // what an extension can do. This module still holds the array it built,
    // and acting on it would refuse widgets off a list the node no longer
    // reads, reporting a refusal nothing can observe.
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('custom', 'duplicate', 'first', () => undefined, {})
    const second = node.addWidget('custom', 'second', 'second', () => {}, {})
    pinName(second, 'duplicate')

    const ownList = [...(node.widgets ?? [])]
    Object.defineProperty(node, 'widgets', {
      get: () => ownList,
      set: () => {},
      configurable: true
    })

    graph.add(node)

    expect(reportError).not.toHaveBeenCalled()
    expect(ownList).toHaveLength(2)
  })

  it('does not re-enter the commit path when a node joins a graph', () => {
    // Handing the walk `node.widgets` gives it the mutation view, so its
    // closing splice runs a whole nested commit from inside the walk — before
    // the refused widget is released or reported, and with anything that
    // throws in there escaping the join with the splice already applied.
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('custom', 'duplicate', 'first', () => undefined, {})
    const second = node.addWidget('custom', 'second', 'second', () => {}, {})
    pinName(second, 'duplicate')

    const replaceNodeWidgetOrder = vi.spyOn(
      useWidgetValueStore(),
      'replaceNodeWidgetOrder'
    )

    graph.add(node)

    expect(names(node)).toEqual(['duplicate'])
    expect(replaceNodeWidgetOrder).not.toHaveBeenCalled()
  })

  it('reports the name the walk read, not what the rename attempts left behind', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const normalising = node.addWidget(
      'number',
      'steps',
      2,
      () => undefined,
      {}
    )
    // Stores a transformed value, so it never answers to the candidate it was
    // offered — and afterwards it holds a name no widget on the node owns,
    // which is what the report must not quote. Its `name` is writable, so the
    // pair is reported as unresolved and the widget is kept, but the name the
    // report has to carry is the same either way.
    let stored = 'seed'
    Object.defineProperty(normalising, 'name', {
      get: () => stored,
      set: (value: string) => {
        stored = `${value}-normalised`
      },
      configurable: true
    })

    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(normalising.name).not.toBe('seed')
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_resolving_widget_duplicate_name',
        context: expect.objectContaining({ widgetName: 'seed' })
      })
    )
    // Kept, not removed: a setter that declines is a recoverable refusal.
    expect(node.widgets).toContain(normalising)
  })

  it('registers an unresolved widget that the node keeps', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const unresolved = node.addWidget('number', 'steps', 2, () => undefined, {})
    let stored = 'seed'
    Object.defineProperty(unresolved, 'name', {
      get: () => stored,
      set: (value: string) => {
        stored = `${value}-normalised`
      },
      configurable: true
    })
    expect(isNodeBindable(unresolved)).toBe(true)
    if (!isNodeBindable(unresolved)) throw new Error('Expected concrete widget')
    const setNodeId = vi.spyOn(unresolved, 'setNodeId')

    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(node.widgets).toContain(unresolved)
    expect(setNodeId).toHaveBeenCalledWith(node.id)
  })

  it('does not report a refusal it cannot carry out on a subgraph node', () => {
    // A `SubgraphNode` rebuilds `widgets` on every read, so nothing this
    // module splices ever leaves the node. Enforcing there anyway reports the
    // alerting contract `failure_renaming_widget_duplicate_name` for a refusal that did
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

    // Same inner widget name on two different inner nodes, which is what
    // promoting `seed` from two samplers produces.
    const firstPromoted = widgetId(rootGraphId, toNodeId(900), 'seed')
    const secondPromoted = widgetId(rootGraphId, toNodeId(901), 'seed')
    store.registerWidget(firstPromoted, {
      type: 'number',
      value: 0,
      options: {}
    })
    store.registerWidget(secondPromoted, {
      type: 'number',
      value: 1,
      options: {}
    })
    host.inputs[0].widgetId = firstPromoted
    host.inputs[1].widgetId = secondPromoted

    expect(host.widgets.map((widget) => widget.name)).toEqual(['seed', 'seed'])

    host.rootGraph.add(host)

    // Still both there: this node class is outside the invariant's reach, and
    // that is the pre-existing behaviour the refusal must not pretend to change.
    expect(host.widgets.map((widget) => widget.name)).toEqual(['seed', 'seed'])
    expect(reportError).not.toHaveBeenCalled()
  })
})
