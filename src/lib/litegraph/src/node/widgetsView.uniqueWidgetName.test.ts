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

function createNode(): LGraphNode {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  graph.add(node)
  return node
}

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

    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(names(node)).toEqual(['seed', 'cfg'])
    expect(node.widgets).not.toContain(second)
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

    expect(names(node)).toEqual(['seed', 'seed#1'])
    expect(storedNames(node)).toEqual(['seed', 'seed#1'])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('refuses a pushed concrete widget that normalization cannot make renamable', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const concrete = node.addWidget('number', 'steps', 2, () => undefined, {})
    node.widgets!.splice(node.widgets!.indexOf(concrete), 1)
    pinName(concrete, 'seed')

    // The other half of the case above. A widget that is *already* concrete
    // keeps the pinned descriptor through `toConcreteWidget`, so deferring the
    // verdict until after normalization does not rescue this one — it is the
    // push that has to be refused, not the raw shape.
    node.widgets!.push(concrete)

    expect(names(node)).toEqual(['seed'])
    expect(storedNames(node)).toEqual(['seed'])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'widget_duplicate_name_refused',
        surface: 'graph'
      })
    )
  })

  it('refuses the later of a pinned pair carried in by a whole-array assignment', () => {
    const node = createNode()
    const kept = node.addWidget('number', 'seed', 1, () => undefined, {})
    const other = node.addWidget('number', 'steps', 2, () => undefined, {})
    pinName(other, 'seed')

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

    const hostile: IBaseWidget = {
      name: 'steps',
      type: 'number',
      value: 2,
      y: 0,
      options: {}
    }
    Object.defineProperty(hostile, 'name', {
      get(): string {
        throw new Error('name is not readable')
      }
    })

    expect(() => node.widgets!.push(hostile)).not.toThrow()
    expect(node.widgets!.indexOf(hostile)).toBe(-1)

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

  it('converts a raw pushed widget whose name throws only on the first read', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    let reads = 0
    const flaky: IBaseWidget = {
      name: 'steps',
      type: 'number',
      value: 2,
      y: 0,
      options: {}
    }
    Object.defineProperty(flaky, 'name', {
      get(): string {
        reads++
        if (reads === 1) throw new Error('name is not readable yet')
        return 'steps'
      }
    })

    expect(() => node.widgets!.push(flaky)).not.toThrow()
    expect(names(node)).toEqual(['seed', 'steps'])
  })

  it('reports the cause the walk decided, not the one a later read suggests', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const flaky = node.addWidget('number', 'steps', 2, () => undefined, {})

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

    const hostile: IBaseWidget = {
      name: 'steps',
      type: 'number',
      value: 2,
      y: 0,
      options: {}
    }
    Object.defineProperty(hostile, 'type', {
      get(): string {
        throw new Error('type is not readable')
      }
    })

    expect(() => node.widgets!.push(hostile)).toThrow('type is not readable')
    expect(reportError).not.toHaveBeenCalled()
  })

  it('clears a slot bound to the refused widget by name, which is how real nodes bind', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const second = node.addWidget('number', 'steps', 2, () => undefined, {})
    node.addInput('steps', 'INT')
    const input = node.inputs.at(-1)!
    input.widget = { name: 'steps' }
    pinName(second, 'steps')

    const third = node.addWidget('number', 'spare', 3, () => undefined, {})
    pinName(third, 'steps')
    node.addWidget('number', 'cfg', 4, () => undefined, {})

    expect(node.widgets!.indexOf(third)).toBe(-1)
    expect(input.widget).toBeUndefined()
  })

  it('does not tear down every input when a hole reaches the refusal', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.addInput('seed', 'INT')
    const input = node.inputs.at(-1)!
    input.widget = { name: 'seed' }

    expect(() => {
      node.widgets!.length += 1
    }).not.toThrow()

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

    expect(() =>
      node.addWidget('number', 'cfg', 3, () => undefined, {})
    ).not.toThrow()

    const errorTypes = vi
      .mocked(reportError)
      .mock.calls.map(([, options]) => options.errorType)
    expect(errorTypes).toHaveLength(2)
    expect(errorTypes).toEqual(
      expect.arrayContaining([
        'failure_tearing_down_refused_widget',
        'failure_renaming_widget_duplicate_name'
      ])
    )
  })

  it('leaves a node alone once it stops exposing the widget list this module owns', () => {
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
    expect(node.widgets).toContain(normalising)
  })

  it('does not report a refusal it cannot carry out on a subgraph node', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'first', type: 'INT' },
        { name: 'second', type: 'INT' }
      ]
    })
    const host = createTestSubgraphNode(subgraph)
    const store = useWidgetValueStore()
    const rootGraphId = host.rootGraph.id

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

    expect(host.widgets.map((widget) => widget.name)).toEqual(['seed', 'seed'])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('releases the entry a refused widget registered, without touching the kept one', () => {
    const node = createNode()
    const kept = node.addWidget('number', 'seed', 1, () => undefined, {})
    const refused = node.addWidget('number', 'seed', 2, () => undefined, {})
    refused.value = 42
    const refusedId = widgetId(node.graph!.rootGraph.id, node.id, 'seed#1')
    let valueSeenOnRemove: unknown
    refused.onRemove = () => {
      valueSeenOnRemove = useWidgetValueStore().getWidget(refusedId)?.value
    }
    pinName(refused, 'seed')
    node.addWidget('number', 'steps', 0, () => undefined, {})

    expect(valueSeenOnRemove).toBe(42)
    expect(storedNames(node)).toEqual(['seed', 'steps'])
    expect(kept.value).toBe(1)
    expect(
      node.addWidget('number', 'seed#1', 7, () => undefined, {}).value
    ).toBe(7)
  })
})
