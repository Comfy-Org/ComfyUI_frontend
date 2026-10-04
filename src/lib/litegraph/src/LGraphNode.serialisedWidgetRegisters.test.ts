import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

/**
 * `serialize()` writes each widget's value into two registers: the positional
 * `widgets_values` and the name-addressed `widgets_values_named`. These cases
 * pin two properties of that pair, both independent of how a repeated widget
 * name is addressed:
 *
 * - every widget name reaches `widgets_values_named` as an **own** key,
 *   including a widget legitimately named `__proto__`;
 * - the two registers are independent copies of **one** snapshot of the live
 *   value, so rewriting one in place cannot reach the other, and the two can
 *   never disagree about what the widget held.
 *
 * Object values use the `custom` widget type because the text and number
 * widgets coerce their value — a `text` widget holding an object serializes as
 * `"[object Object]"`, which would make an aliasing assertion vacuous. The
 * product widgets that genuinely hold object values (`boundingbox`, `curve`,
 * `colors`, `chart`, `compositor`) behave the same as `custom` here.
 */
describe('serialised widget registers', () => {
  let node: LGraphNode
  const namedValuesRestore = LiteGraph.namedValuesRestore

  afterEach(() => {
    // One case below turns this on; it is global, so hand it back.
    LiteGraph.namedValuesRestore = namedValuesRestore
  })

  beforeEach(() => {
    LiteGraph.namedValuesRestore = false
    node = new LGraphNode('TestNode')
    // Node registration sets this for every real node that has widgets; a bare
    // `LGraphNode` leaves it undefined and `serialize()` then writes neither
    // register.
    node.serialize_widgets = true
  })

  describe('a widget named __proto__', () => {
    it('reaches widgets_values_named as an own key', () => {
      node.addWidget('text', '__proto__', 'carried', null, {})

      const named = node.serialize().widgets_values_named!

      expect(Object.hasOwn(named, '__proto__')).toBe(true)
      expect(Object.getOwnPropertyDescriptor(named, '__proto__')?.value).toBe(
        'carried'
      )
    })

    it('keeps its value across a save and a named restore', () => {
      node.addWidget('text', '__proto__', 'carried', null, {})
      const serialised = JSON.parse(JSON.stringify(node.serialize()))

      LiteGraph.namedValuesRestore = true
      const restored = new LGraphNode('TestNode')
      restored.serialize_widgets = true
      restored.addWidget('text', '__proto__', 'default', null, {})
      restored.configure(serialised)

      expect(restored.widgets![0].value).toBe('carried')
    })

    it('does not become the register prototype when its value is an object', () => {
      // Assigned through the inherited `__proto__` setter, an object value
      // becomes the register's prototype: it vanishes from the JSON, and every
      // key it carries then answers a lookup for a widget that does not exist.
      node.addWidget(
        'custom' as never,
        '__proto__',
        { smuggled: 1 } as never,
        null,
        {}
      )

      const named = node.serialize().widgets_values_named!

      expect(Object.getPrototypeOf(named)).toBeNull()
      expect((named as Record<string, unknown>)['smuggled']).toBeUndefined()
      expect(
        Object.getOwnPropertyDescriptor(named, '__proto__')?.value
      ).toEqual({ smuggled: 1 })
    })

    it('survives a JSON round trip as an own key', () => {
      node.addWidget('text', '__proto__', 'carried', null, {})

      const reparsed = JSON.parse(JSON.stringify(node.serialize()))

      expect(Object.hasOwn(reparsed.widgets_values_named, '__proto__')).toBe(
        true
      )
      expect(
        Object.getOwnPropertyDescriptor(
          reparsed.widgets_values_named,
          '__proto__'
        )?.value
      ).toBe('carried')
    })

    it('leaves an ordinary name as an own key without inherited names', () => {
      node.addWidget('text', 'ordinary', 'value', null, {})

      const named = node.serialize().widgets_values_named!

      expect(Object.hasOwn(named, 'ordinary')).toBe(true)
      expect(named['ordinary']).toBe('value')
      expect(Object.getPrototypeOf(named)).toBeNull()
      expect(named['constructor']).toBeUndefined()
    })
  })

  describe('register independence', () => {
    const objectValueNode = () => {
      const target = new LGraphNode('TestNode')
      target.serialize_widgets = true
      const widget = target.addWidget(
        'custom' as never,
        'settings',
        { nested: { depth: 1 } } as never,
        null,
        {}
      )
      return { target, widget }
    }

    it('gives each register its own copy of an object value', () => {
      const { target } = objectValueNode()

      const serialised = target.serialize()

      expect(serialised.widgets_values_named!['settings']).toEqual({
        nested: { depth: 1 }
      })
      expect(serialised.widgets_values_named!['settings']).not.toBe(
        serialised.widgets_values![0]
      )
    })

    it('does not let an in-place rewrite of the positional register reach the named one', () => {
      const { target } = objectValueNode()
      const serialised = target.serialize()

      const positional = serialised.widgets_values![0] as {
        nested: { depth: number }
      }
      positional.nested.depth = 99

      expect(serialised.widgets_values_named!['settings']).toEqual({
        nested: { depth: 1 }
      })
    })

    it('does not let an in-place rewrite of the named register reach the positional one', () => {
      const { target } = objectValueNode()
      const serialised = target.serialize()

      const named = serialised.widgets_values_named!['settings'] as {
        nested: { depth: number }
      }
      named.nested.depth = 99

      expect(serialised.widgets_values![0]).toEqual({ nested: { depth: 1 } })
    })

    it('copies out of the live widget rather than aliasing it', () => {
      const { target, widget } = objectValueNode()
      const serialised = target.serialize()

      ;(widget.value as unknown as { nested: { depth: number } }).nested.depth =
        99

      expect(serialised.widgets_values![0]).toEqual({ nested: { depth: 1 } })
      expect(serialised.widgets_values_named!['settings']).toEqual({
        nested: { depth: 1 }
      })
    })

    it('keeps primitive values identical in both registers', () => {
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('text', 'prompt', 'hello', null, {})

      const serialised = node.serialize()

      expect(serialised.widgets_values).toEqual([20, 'hello'])
      expect(serialised.widgets_values_named).toEqual({
        steps: 20,
        prompt: 'hello'
      })
    })

    it('still skips a widget that opts out of serialization', () => {
      node.addWidget('text', 'kept', 'yes', null, {})
      const skipped = node.addWidget('text', 'dropped', 'no', null, {})
      skipped.serialize = false

      const serialised = node.serialize()

      expect(serialised.widgets_values).toEqual(['yes'])
      expect(serialised.widgets_values_named).toEqual({ kept: 'yes' })
    })

    it('reads the live widget value once, not once per register', () => {
      const widget = node.addWidget('text', 'prompt', 'typed', null, {})
      let reads = 0
      // An own `value` accessor is the real shape, not a contrivance: every DOM
      // widget gets one installed on the instance (`domWidget.ts`), and it
      // forwards to a custom node's `options.getValue()`.
      Object.defineProperty(widget, 'value', {
        configurable: true,
        get() {
          reads++
          return reads === 1 ? 'typed' : 'changed'
        }
      })

      const serialised = node.serialize()

      expect(reads).toBe(1)
      expect(serialised.widgets_values).toEqual(['typed'])
      expect(serialised.widgets_values_named).toEqual({ prompt: 'typed' })
    })

    it('puts one snapshot in both registers when the value re-encodes differently', () => {
      // `JSON.stringify` calls `toJSON`, so a value that answers differently
      // each time lands differently in each register if each register encodes
      // its own read.
      let encodes = 0
      const value = {
        toJSON: () => ({ encode: ++encodes })
      }
      node.addWidget('custom', 'settings', value, null, {})

      const serialised = node.serialize()

      expect(serialised.widgets_values![0]).toEqual({ encode: 1 })
      expect(serialised.widgets_values_named!['settings']).toEqual({
        encode: 1
      })
      expect(encodes).toBe(1)
    })

    it('writes null for a widget whose value is undefined', () => {
      const widget = node.addWidget('text', 'empty', '', null, {})
      widget.value = undefined

      const serialised = node.serialize()

      expect(serialised.widgets_values).toEqual([null])
      expect(serialised.widgets_values_named).toEqual({ empty: null })
    })
  })
})
