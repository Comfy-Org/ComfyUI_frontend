import { afterEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { WidgetValue } from '@/types/simplifiedWidget'

function serialisedNode(
  widgets: readonly { name: string; value: WidgetValue }[]
): ISerialisedNode {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  node.serialize_widgets = true
  graph.add(node)
  for (const { name, value } of widgets) {
    node.addWidget('custom', name, value, () => undefined, {})
  }
  return node.serialize()
}

describe('serialised widget registers', () => {
  afterEach(() => {
    LiteGraph.namedValuesRestore = false
  })

  describe('a widget named __proto__', () => {
    it('lands as an own key rather than through the inherited setter', () => {
      const named = serialisedNode([
        { name: '__proto__', value: 'kept' }
      ]).widgets_values_named!

      expect(Object.hasOwn(named, '__proto__')).toBe(true)
      expect(named['__proto__']).toBe('kept')
    })

    it('does not replace the register object’s prototype', () => {
      const named = serialisedNode([
        { name: '__proto__', value: { replaced: true } }
      ]).widgets_values_named!

      // Assigning an object under this name would have made it the prototype,
      // leaving the register with no own key and a poisoned lookup chain.
      expect(Object.getPrototypeOf(named)).toBe(Object.prototype)
      expect(Object.hasOwn(named, '__proto__')).toBe(true)
    })

    it('survives the JSON round trip a saved workflow makes', () => {
      const saved = JSON.parse(
        JSON.stringify(serialisedNode([{ name: '__proto__', value: 'kept' }]))
      ) as ISerialisedNode

      expect(Object.hasOwn(saved.widgets_values_named!, '__proto__')).toBe(true)
    })

    it('restores its saved value instead of falling back to the default', () => {
      LiteGraph.namedValuesRestore = true
      const saved = JSON.parse(
        JSON.stringify(serialisedNode([{ name: '__proto__', value: 'kept' }]))
      ) as ISerialisedNode

      const graph = new LGraph()
      const node = new LGraphNode('test')
      graph.add(node)
      node.addWidget('custom', '__proto__', 'default', () => undefined, {})
      node.configure(saved)

      // The restore reads through `Object.hasOwn`, so a name that never became
      // an own key resolves to nothing and the widget keeps its default.
      expect(node.widgets![0].value).toBe('kept')
    })
  })

  describe('register independence', () => {
    it('gives each register its own clone of an object value', () => {
      const serialised = serialisedNode([
        { name: 'config', value: { nested: { depth: 1 } } }
      ])
      const positional = serialised.widgets_values as Record<
        string,
        Record<string, number>
      >[]
      const named = serialised.widgets_values_named as Record<
        string,
        Record<string, Record<string, number>>
      >

      expect(positional[0]).toEqual(named['config'])
      expect(positional[0]).not.toBe(named['config'])

      positional[0].nested.depth = 2

      expect(named['config'].nested.depth).toBe(1)
    })

    it('reads the widget value once, so a stateful getter cannot split the registers', () => {
      const graph = new LGraph()
      const node = new LGraphNode('test')
      node.serialize_widgets = true
      graph.add(node)
      let reads = 0
      node.addWidget('custom', 'counter', { nth: 0 }, () => undefined, {})
      Object.defineProperty(node.widgets![0], 'value', {
        get: () => ({ nth: ++reads }),
        configurable: true
      })

      const serialised = node.serialize()

      // Two reads would give the registers different values, and they have
      // always been equal by construction.
      expect(serialised.widgets_values_named!['counter']).toEqual(
        serialised.widgets_values![0]
      )
      expect(reads).toBe(1)
    })

    it('leaves the live widget value untouched by either register', () => {
      const graph = new LGraph()
      const node = new LGraphNode('test')
      node.serialize_widgets = true
      graph.add(node)
      const live = { nested: { depth: 1 } }
      node.addWidget('custom', 'config', live, () => undefined, {})

      const serialised = node.serialize()
      const named = serialised.widgets_values_named as Record<
        string,
        Record<string, Record<string, number>>
      >
      named['config'].nested.depth = 99

      expect(live.nested.depth).toBe(1)
    })

    it('still writes no value for a widget that does not serialize', () => {
      const graph = new LGraph()
      const node = new LGraphNode('test')
      node.serialize_widgets = true
      graph.add(node)
      node.addWidget('custom', 'kept', 'a', () => undefined, {})
      const skipped = node.addWidget(
        'custom',
        'skipped',
        'b',
        () => undefined,
        {}
      )
      skipped.serialize = false

      const serialised = node.serialize()

      expect(serialised.widgets_values).toEqual(['a'])
      expect(Object.hasOwn(serialised.widgets_values_named!, 'skipped')).toBe(
        false
      )
    })
  })
})
