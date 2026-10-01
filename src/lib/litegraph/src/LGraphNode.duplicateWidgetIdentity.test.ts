import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedNode,
  ISerialisedWidgetValueEntry
} from '@/lib/litegraph/src/types/serialisation'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

/**
 * `widgets_values_named` cannot represent two serializable widgets that share a
 * name — the later one overwrites the earlier — and a name-addressed consumer
 * cannot read `widgets_values` back. `widgets_values_ordered` carries
 * `(name, occurrence, value)` so both survive.
 *
 * Mirrors `@comfyorg/comfy-multi-player` schema v5 Amendment A22
 * (`test/widget-occurrence-identity.test.ts`), which addresses `set_widget` by
 * the same zero-based occurrence and keeps this field's matching entry coherent.
 */
describe('duplicate widget-name identity', () => {
  let node: LGraphNode

  /** Two dict values, each with a key the other does not have. */
  const firstValue = {
    trim: { start_time: 1, duration: 2 },
    extension_only: { untouched: true }
  }
  const secondValue = {
    crop: { x: 1, y: 2, width: 3, height: 4 },
    unknown_key: ['kept', 2]
  }

  function serialisedNode(
    overrides: Partial<ISerialisedNode> = {}
  ): ISerialisedNode {
    return {
      id: 1,
      type: 'TestNode',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      ...overrides
    }
  }

  function addDuplicatePair() {
    node.addWidget('custom', 'same', 'first default', () => {})
    node.addWidget('custom', 'same', 'second default', () => {})
    node.serialize_widgets = true
  }

  beforeEach(() => {
    node = new LGraphNode('TestNode')
  })

  afterEach(() => {
    LiteGraph.namedValuesRestore = false
  })

  describe('serialization', () => {
    it('emits every serializable widget keyed by (name, occurrence) when a name repeats', () => {
      addDuplicatePair()
      node.addWidget('number', 'unique', 7, () => {})
      node.widgets![0].value = firstValue
      node.widgets![1].value = secondValue

      const serialised = node.serialize()

      expect(serialised.widgets_values_ordered).toEqual([
        { name: 'same', occurrence: 0, value: firstValue },
        { name: 'same', occurrence: 1, value: secondValue },
        { name: 'unique', occurrence: 0, value: 7 }
      ])
      // The two legacy forms are unchanged: positional keeps both values,
      // named keeps only the last widget of the repeated name.
      expect(serialised.widgets_values).toEqual([firstValue, secondValue, 7])
      expect(serialised.widgets_values_named).toEqual({
        same: secondValue,
        unique: 7
      })
    })

    it('omits the ordered field entirely when no name repeats', () => {
      node.addWidget('number', 'steps', 20, () => {})
      node.addWidget('number', 'seed', 0, () => {})
      node.serialize_widgets = true

      const serialised = node.serialize()

      // Absence is the contract, not merely an empty array: an ordinary
      // workflow must not grow a redundant third copy of its widget values.
      expect(serialised).not.toHaveProperty('widgets_values_ordered')
      expect(serialised.widgets_values).toEqual([20, 0])
    })

    it('excludes non-serializing widgets from the occurrence count', () => {
      node.addWidget('custom', 'same', 'first', () => {})
      node.addWidget('button', 'same', 'skipped', () => {})
      node.widgets![1].serialize = false
      node.addWidget('custom', 'same', 'second', () => {})
      node.serialize_widgets = true

      expect(node.serialize().widgets_values_ordered).toEqual([
        { name: 'same', occurrence: 0, value: 'first' },
        { name: 'same', occurrence: 1, value: 'second' }
      ])
    })
  })

  describe('name-addressed restore', () => {
    beforeEach(() => {
      LiteGraph.namedValuesRestore = true
    })

    it('restores both occurrences from the ordered field', () => {
      addDuplicatePair()

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: firstValue },
            { name: 'same', occurrence: 1, value: secondValue }
          ]
        })
      )

      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        firstValue,
        secondValue
      ])
    })

    it('collapses onto the last value without the ordered field', () => {
      addDuplicatePair()

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue }
        })
      )

      // Pins the loss this field exists to remove, so the fix stays scoped to
      // documents that actually carry the ordered form.
      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        secondValue,
        secondValue
      ])
    })

    it('keeps the named value for the final occurrence when the two disagree', () => {
      addDuplicatePair()
      const namedOnlyWrite = { crop: { x: 99 } }

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, namedOnlyWrite],
          widgets_values_named: { same: namedOnlyWrite },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: firstValue },
            { name: 'same', occurrence: 1, value: secondValue }
          ]
        })
      )

      // A name-only writer that predates occurrence addressing can only reach
      // one register, and both this serializer and the comfy-multi-player
      // projection put it at the last occurrence. Reading `named` there keeps
      // such a write; earlier occurrences are only in the ordered form.
      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        firstValue,
        namedOnlyWrite
      ])
    })

    it('leaves unique names on the named path', () => {
      node.addWidget('custom', 'same', 'a', () => {})
      node.addWidget('custom', 'same', 'b', () => {})
      node.addWidget('number', 'unique', 0, () => {})
      node.serialize_widgets = true

      node.configure(
        serialisedNode({
          widgets_values: ['first', 'second', 1],
          widgets_values_named: { same: 'second', unique: 42 },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: 'first' },
            { name: 'same', occurrence: 1, value: 'second' },
            { name: 'unique', occurrence: 0, value: 1 }
          ]
        })
      )

      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        'first',
        'second',
        42
      ])
    })

    it('survives a serialize/configure round trip on a fresh node', () => {
      addDuplicatePair()
      node.widgets![0].value = firstValue
      node.widgets![1].value = secondValue
      const serialised = JSON.parse(
        JSON.stringify(node.serialize())
      ) as ISerialisedNode

      const reloaded = new LGraphNode('TestNode')
      reloaded.addWidget('custom', 'same', 'first default', () => {})
      reloaded.addWidget('custom', 'same', 'second default', () => {})
      reloaded.serialize_widgets = true
      reloaded.configure(serialised)

      expect(reloaded.widgets!.map((widget) => widget.value)).toEqual([
        firstValue,
        secondValue
      ])
      expect(reloaded.serialize().widgets_values_ordered).toEqual(
        serialised.widgets_values_ordered
      )
    })

    it('ignores malformed entries and falls back to the named value', () => {
      addDuplicatePair()
      const malformed = [
        null,
        'not an entry',
        { name: 'same' },
        { name: 'same', occurrence: -1, value: 'negative' },
        { name: 'same', occurrence: 1.5, value: 'fractional' },
        { occurrence: 0, value: 'nameless' }
      ] as unknown as ISerialisedWidgetValueEntry[]

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue },
          widgets_values_ordered: malformed
        })
      )

      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        secondValue,
        secondValue
      ])
    })

    it('never lets a non-integer occurrence become the highest one', () => {
      addDuplicatePair()

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: firstValue },
            // Only this entry claims an occurrence above 0. Accepting it would
            // make occurrence 0 look like a non-final one and hand it
            // `firstValue`, on the strength of an identity the key encoding
            // cannot represent.
            { name: 'same', occurrence: 2.5, value: 'fractional' }
          ]
        })
      )

      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        secondValue,
        secondValue
      ])
    })

    it('addresses each middle occurrence independently', () => {
      node.addWidget('custom', 'same', 'a', () => {})
      node.addWidget('custom', 'same', 'b', () => {})
      node.addWidget('custom', 'same', 'c', () => {})
      node.serialize_widgets = true

      node.configure(
        serialisedNode({
          widgets_values: ['first', 'second', 'third'],
          widgets_values_named: { same: 'third' },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: 'first' },
            { name: 'same', occurrence: 1, value: 'second' },
            { name: 'same', occurrence: 2, value: 'third' }
          ]
        })
      )

      // Occurrence 1 must read its own entry. A lookup that ignored the
      // occurrence would give it `'first'` and still satisfy a two-widget case.
      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        'first',
        'second',
        'third'
      ])
    })

    it('preserves an entry key it does not understand', () => {
      addDuplicatePair()
      const withExtras = [
        { name: 'same', occurrence: 0, value: firstValue, source: 'extension' },
        { name: 'same', occurrence: 1, value: secondValue }
      ] as unknown as ISerialisedWidgetValueEntry[]

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue },
          widgets_values_ordered: withExtras
        })
      )

      expect(node.widgets![0].value).toEqual(firstValue)
      expect(node.widgets![1].value).toEqual(secondValue)
    })

    it('distinguishes identities whose names contain the key separator', () => {
      const hostile = ' 0'
      node.addWidget('custom', hostile, 'hostile first', () => {})
      node.addWidget('custom', hostile, 'hostile second', () => {})
      node.addWidget('custom', '', 'empty name', () => {})
      node.serialize_widgets = true

      const serialised = node.serialize()
      expect(serialised.widgets_values_ordered).toEqual([
        { name: hostile, occurrence: 0, value: 'hostile first' },
        { name: hostile, occurrence: 1, value: 'hostile second' },
        { name: '', occurrence: 0, value: 'empty name' }
      ])

      const reloaded = new LGraphNode('TestNode')
      reloaded.addWidget('custom', hostile, 'x', () => {})
      reloaded.addWidget('custom', hostile, 'y', () => {})
      reloaded.addWidget('custom', '', 'z', () => {})
      reloaded.serialize_widgets = true
      reloaded.configure(serialised)

      expect(reloaded.widgets!.map((widget) => widget.value)).toEqual([
        'hostile first',
        'hostile second',
        'empty name'
      ])
    })

    it('falls back to the named value for an occurrence the document lacks', () => {
      node.addWidget('custom', 'same', 'a', () => {})
      node.addWidget('custom', 'same', 'b', () => {})
      node.addWidget('custom', 'same', 'c', () => {})
      node.serialize_widgets = true

      node.configure(
        serialisedNode({
          widgets_values: ['first', 'second'] as TWidgetValue[],
          widgets_values_named: { same: 'second' },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: 'first' },
            { name: 'same', occurrence: 1, value: 'second' }
          ]
        })
      )

      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        'first',
        'second',
        'second'
      ])
    })
  })
})
