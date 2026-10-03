import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import {
  readOrderedWidgetValues,
  widgetIdentityKey
} from '@/lib/litegraph/src/utils/widgetIdentity'

/**
 * The separator `widgetIdentityKey` puts between occurrence and name. Written
 * as an escape, never as a raw byte: a raw control byte makes the whole file
 * binary to git, which hides it from the diff and from every grep-based audit.
 */
const KEY_SEPARATOR = '\u0000'

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

  /**
   * A loaded document whose `widgets_values_ordered` is whatever a foreign
   * producer actually wrote.
   *
   * The workflow schema passes the field through unvalidated, so
   * `ISerialisedNode` describes this app's own writer rather than what arrives
   * from a file. Malformed rows therefore pass `unknown` and this one place
   * models the gap, instead of each row asserting invalid data into the
   * writer's type. `readOrderedWidgetValues` is the parser that has to cope.
   */
  function foreignDocument(
    ordered: unknown,
    overrides: Partial<ISerialisedNode> = {}
  ): ISerialisedNode {
    const document = serialisedNode(overrides)
    Object.assign(document, { widgets_values_ordered: ordered })
    return document
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

    it('restores each occurrence added during onConfigure', () => {
      node.onConfigure = () => addDuplicatePair()

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

    it('restores a widget that an earlier widget’s setter appended', () => {
      addDuplicatePair()
      // An extension can grow the widget list from a value setter:
      // `src/extensions/core/customWidgets.ts` adds the next `optionN` as
      // soon as the previous one is filled in. Restore therefore walks the
      // live list — over a snapshot the appended widget is never visited and
      // keeps its construction default, which is how a clone/paste of such a
      // node loses its last option.
      const trigger = node.addWidget('string', 'trigger', '', () => {})
      let stored = ''
      Object.defineProperty(trigger, 'value', {
        get: () => stored,
        set(next: string) {
          stored = next
          if (!next) return
          if (node.widgets!.some(({ name }) => name === 'grown')) return
          // Pushed rather than added through `addWidget`, which is what an
          // extension that owns its own widget objects does, and what leaves
          // the restore walk as the only thing that can give this one a
          // value.
          node.widgets!.push({
            name: 'grown',
            type: 'string',
            value: 'construction default',
            options: {},
            y: 0,
            draw: () => undefined
          })
        }
      })

      node.configure(
        serialisedNode({
          widgets_values_named: {
            same: secondValue,
            trigger: 'filled',
            grown: 'grown value'
          },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: firstValue },
            { name: 'same', occurrence: 1, value: secondValue }
          ]
        })
      )

      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        firstValue,
        secondValue,
        'filled',
        'grown value'
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
      const malformed: unknown = [
        null,
        'not an entry',
        { name: 'same' },
        { name: 'same', occurrence: -1, value: 'negative' },
        { name: 'same', occurrence: 1.5, value: 'fractional' },
        { occurrence: 0, value: 'nameless' }
      ]

      node.configure(
        foreignDocument(malformed, {
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue }
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

    it('tolerates an entry key it does not understand', () => {
      addDuplicatePair()
      const withExtras = [
        { name: 'same', occurrence: 0, value: firstValue, source: 'extension' },
        { name: 'same', occurrence: 1, value: secondValue }
      ]

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
      // Spelled apart from the digit that follows it: inlined, the two
      // would read as a single five-digit escape.
      const hostile = `${KEY_SEPARATOR}0`
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
          widgets_values: ['first', 'second'],
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

    it('reads the final occurrence from the ordered form when named has no key for the name', () => {
      addDuplicatePair()

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          // A document whose `named` register never learned this name — the
          // `__proto__` case below produces exactly this shape.
          widgets_values_named: { unrelated: 'other' },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: firstValue },
            { name: 'same', occurrence: 1, value: secondValue }
          ]
        })
      )

      // Deferring to `named` at the final occurrence only makes sense when
      // `named` actually holds something for the name. Otherwise the last
      // entry is write-only data and the widget silently keeps its default.
      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        firstValue,
        secondValue
      ])
    })

    it('restores from the ordered form alone when the document has no named register', () => {
      addDuplicatePair()

      node.configure(
        serialisedNode({
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: firstValue },
            { name: 'same', occurrence: 1, value: secondValue }
          ]
        })
      )

      // The ordered form lists every serializable widget of the node that
      // wrote it, so it is sufficient on its own. A newer or third-party
      // producer may emit it without `widgets_values_named`.
      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        firstValue,
        secondValue
      ])
    })

    it('leaves a widget an ordered-only document omits on its positional value', () => {
      node.addWidget('custom', 'a', 'construction default a', () => {})
      node.addWidget('custom', 'b', 'construction default b', () => {})
      node.serialize_widgets = true

      node.configure(
        serialisedNode({
          widgets_values: ['positional-a', 'positional-b'],
          widgets_values_ordered: [
            { name: 'a', occurrence: 0, value: 'ordered-a' }
          ]
        })
      )

      // Nothing obliges a third-party producer to list every live widget, and
      // switching the whole node to name-addressed restore on the strength of
      // a partial field would leave `b` on its construction default — strictly
      // worse than the positional restore it would have had without the field.
      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        'ordered-a',
        'positional-b'
      ])
    })

    it('still treats a missing name as "no value" when a named register exists', () => {
      node.addWidget('custom', 'a', 'construction default a', () => {})
      node.addWidget('custom', 'b', 'construction default b', () => {})
      node.serialize_widgets = true

      node.configure(
        serialisedNode({
          widgets_values: ['positional-a', 'positional-b'],
          widgets_values_named: { a: 'named-a' },
          widgets_values_ordered: [
            { name: 'a', occurrence: 0, value: 'ordered-a' }
          ]
        })
      )

      // The positional fall-through above is scoped to a document with no
      // named register. Where one exists, an absent name already meant "no
      // value", and that reading predates this field.
      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        'named-a',
        'construction default b'
      ])
    })

    it('gives a surviving widget the named value when the document has more occurrences than the node', () => {
      node.addWidget('custom', 'same', 'construction default', () => {})
      node.serialize_widgets = true

      node.configure(
        serialisedNode({
          widgets_values: ['first', 'second'],
          widgets_values_named: { same: 'second' },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: 'first' },
            { name: 'same', occurrence: 1, value: 'second' }
          ]
        })
      )

      // A newer node definition dropped one of two same-named widgets. Which
      // document entry the survivor corresponds to is unknowable, so it keeps
      // what a name-addressed read gave it before this field existed, and the
      // two drift directions stay consistent with each other.
      expect(node.widgets!.map((widget) => widget.value)).toEqual(['second'])
    })

    it('rejects a string occurrence that would collide with a well-formed identity', () => {
      node.addWidget('custom', 'same', 'a', () => {})
      node.addWidget('custom', 'same', 'b', () => {})
      node.addWidget('custom', 'same', 'c', () => {})
      node.serialize_widgets = true

      node.configure(
        foreignDocument(
          [
            { name: 'same', occurrence: 0, value: 'first' },
            { name: 'same', occurrence: 1, value: 'second' },
            { name: 'same', occurrence: 2, value: 'third' },
            // `String('0')` is `'0'`, so without the integer guard this entry
            // takes occurrence 0's key and overwrites a well-formed identity.
            { name: 'same', occurrence: '0', value: 'hijacked' }
          ],
          {
            widgets_values: ['first', 'second', 'third'],
            widgets_values_named: { same: 'third' }
          }
        )
      )

      expect(node.widgets!.map((widget) => widget.value)).toEqual([
        'first',
        'second',
        'third'
      ])
    })

    it.for([
      ['an object', {}],
      ['a number', 5],
      ['a string', 'ordered'],
      ['a boolean', true]
    ] as const)(
      'loads the node without throwing when widgets_values_ordered is %s',
      ([, container]) => {
        addDuplicatePair()

        // `createWidgetRestorationState` runs outside `configure`'s
        // try/finally, so a TypeError on this untrusted field would abort the
        // whole graph load rather than degrade one node.
        expect(() => {
          node.configure(
            foreignDocument(container, {
              widgets_values: [firstValue, secondValue],
              widgets_values_named: { same: secondValue }
            })
          )
        }).not.toThrow()

        expect(node.widgets!.map((widget) => widget.value)).toEqual([
          secondValue,
          secondValue
        ])
      }
    )
  })

  describe('a widget named __proto__', () => {
    beforeEach(() => {
      LiteGraph.namedValuesRestore = true
    })

    /** Repeats `same` so the ordered field is emitted at all. */
    function addProtoNamedWidget() {
      node.addWidget('custom', '__proto__', 'construction default', () => {})
      addDuplicatePair()
    }

    it('becomes an own key of the named register rather than a prototype write', () => {
      addProtoNamedWidget()
      node.widgets![0].value = 'prototype named'

      const serialised = node.serialize()
      const named = serialised.widgets_values_named!

      // A plain object literal routes this assignment through the inherited
      // `__proto__` setter: no own key, nothing in the JSON, and the widget
      // resets to its construction default on restore.
      expect(Object.hasOwn(named, '__proto__')).toBe(true)
      expect(named['__proto__']).toBe('prototype named')
      // Null-prototype internally, ordinary object on the way out, so every
      // existing consumer of this field still sees `Object.prototype`.
      expect(Object.getPrototypeOf(named)).toBe(Object.prototype)
      expect(
        JSON.parse(JSON.stringify(serialised)).widgets_values_named.__proto__
      ).toBe('prototype named')
    })

    it('survives a serialize/configure round trip', () => {
      addProtoNamedWidget()
      node.widgets![0].value = 'prototype named'
      node.widgets![1].value = firstValue
      node.widgets![2].value = secondValue
      const serialised = JSON.parse(
        JSON.stringify(node.serialize())
      ) as ISerialisedNode

      const reloaded = new LGraphNode('TestNode')
      reloaded.addWidget(
        'custom',
        '__proto__',
        'construction default',
        () => {}
      )
      reloaded.addWidget('custom', 'same', 'first default', () => {})
      reloaded.addWidget('custom', 'same', 'second default', () => {})
      reloaded.serialize_widgets = true
      reloaded.configure(serialised)

      expect(reloaded.widgets!.map((widget) => widget.value)).toEqual([
        'prototype named',
        firstValue,
        secondValue
      ])
    })
  })

  it('keeps the positional default when constructor is absent from the named register', () => {
    LiteGraph.namedValuesRestore = true
    node.addWidget('text', 'constructor', 'default-c', () => {})
    addDuplicatePair()

    node.configure(
      serialisedNode({
        widgets_values: ['default-c', firstValue, secondValue],
        widgets_values_named: { same: secondValue },
        widgets_values_ordered: [
          { name: 'same', occurrence: 0, value: firstValue },
          { name: 'same', occurrence: 1, value: secondValue }
        ]
      })
    )

    expect(node.widgets!.map((widget) => widget.value)).toEqual([
      'default-c',
      firstValue,
      secondValue
    ])
  })

  describe('register independence', () => {
    it('gives each serialized register its own copy of every value', () => {
      addDuplicatePair()
      node.widgets![0].value = firstValue
      node.widgets![1].value = secondValue

      const serialised = node.serialize()
      const positional = serialised.widgets_values!
      const named = serialised.widgets_values_named!
      const ordered = serialised.widgets_values_ordered!

      // Rewriting one entry's `value` in place is the pattern
      // `ISerialisedWidgetValueEntry` sanctions. Aliased registers would make
      // it reach `widgets_values`, `widgets_values_named`, and — for a
      // repeated name — a different widget's slot. Nothing breaks the aliasing
      // on the in-memory `configure(serialize())` paths: copy/paste, undo,
      // subgraph conversion.
      ;(ordered[0].value as Record<string, unknown>).trim = 'rewritten'
      ;(ordered[1].value as Record<string, unknown>).crop = 'rewritten'
      expect(positional[0]).toEqual(firstValue)
      expect(positional[1]).toEqual(secondValue)
      expect(named['same']).toEqual(secondValue)
      ;(named['same'] as Record<string, unknown>).crop = 'rewritten again'
      expect(positional[1]).toEqual(secondValue)
    })

    it('keeps the live widget value out of every register', () => {
      addDuplicatePair()
      node.widgets![0].value = firstValue
      node.widgets![1].value = secondValue

      const serialised = node.serialize()
      ;(
        serialised.widgets_values_ordered![0].value as Record<string, unknown>
      ).trim = 'rewritten'

      expect(node.widgets![0].value).toEqual(firstValue)
    })
  })

  describe('unknown entry keys across a load/save cycle', () => {
    beforeEach(() => {
      LiteGraph.namedValuesRestore = true
    })

    it('writes back a producer-specific key it does not interpret', () => {
      addDuplicatePair()

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue },
          widgets_values_ordered: [
            {
              name: 'same',
              occurrence: 0,
              value: firstValue,
              source: 'extension'
            },
            { name: 'same', occurrence: 1, value: secondValue }
          ]
        })
      )

      // Rebuilding the field from `{ name, value }` alone deletes another
      // producer's metadata on every save, which is the loss the entry
      // contract forbids.
      expect(node.serialize().widgets_values_ordered).toEqual([
        { name: 'same', occurrence: 0, value: firstValue, source: 'extension' },
        { name: 'same', occurrence: 1, value: secondValue }
      ])
    })

    it('never lets an unknown key shadow the identity or the live value', () => {
      addDuplicatePair()

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: firstValue, extra: 1 },
            { name: 'same', occurrence: 1, value: secondValue }
          ]
        })
      )
      node.widgets![0].value = 'edited after load'

      expect(node.serialize().widgets_values_ordered).toEqual([
        { name: 'same', occurrence: 0, value: 'edited after load', extra: 1 },
        { name: 'same', occurrence: 1, value: secondValue }
      ])
    })

    it('drops the keys of an identity the node no longer has', () => {
      addDuplicatePair()

      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue },
          widgets_values_ordered: [
            { name: 'same', occurrence: 0, value: firstValue },
            { name: 'same', occurrence: 1, value: secondValue },
            { name: 'same', occurrence: 2, value: 'gone', source: 'extension' }
          ]
        })
      )

      expect(node.serialize().widgets_values_ordered).toEqual([
        { name: 'same', occurrence: 0, value: firstValue },
        { name: 'same', occurrence: 1, value: secondValue }
      ])
    })

    it('forgets the keys when the node is reconfigured without the field', () => {
      addDuplicatePair()

      node.configure(
        serialisedNode({
          widgets_values_named: { same: secondValue },
          widgets_values_ordered: [
            {
              name: 'same',
              occurrence: 0,
              value: firstValue,
              source: 'extension'
            },
            { name: 'same', occurrence: 1, value: secondValue }
          ]
        })
      )
      node.configure(
        serialisedNode({
          widgets_values: [firstValue, secondValue],
          widgets_values_named: { same: secondValue }
        })
      )

      expect(node.serialize().widgets_values_ordered).toEqual([
        { name: 'same', occurrence: 0, value: secondValue },
        { name: 'same', occurrence: 1, value: secondValue }
      ])
    })
  })
  describe('the boundary parser', () => {
    /**
     * `readOrderedWidgetValues` is where the shape of this untrusted field is
     * established, so these rows drive it directly with what a file can hold
     * rather than through a node.
     */
    it.for([
      ['an object', {}],
      ['a number', 5],
      ['a string', 'ordered'],
      ['a boolean', true],
      ['null', null],
      ['absent', undefined]
    ] as const)('rejects a container that is %s', ([, container]) => {
      expect(readOrderedWidgetValues(container)).toBeUndefined()
    })

    it.for([
      ['null', null],
      ['a string', 'not an entry'],
      ['an entry with no occurrence', { name: 'same' }],
      ['an entry with no name', { occurrence: 0, value: 'nameless' }],
      ['a negative occurrence', { name: 'same', occurrence: -1, value: 'x' }],
      [
        'a fractional occurrence',
        { name: 'same', occurrence: 1.5, value: 'x' }
      ],
      ['a string occurrence', { name: 'same', occurrence: '0', value: 'x' }],
      ['a function value', { name: 'same', occurrence: 0, value: () => {} }]
    ] as const)('skips %s', ([, entry]) => {
      expect(readOrderedWidgetValues([entry])).toBeUndefined()
    })

    it('keeps the usable entries of a partly malformed field', () => {
      const parsed = readOrderedWidgetValues([
        'not an entry',
        { name: 'same', occurrence: 1, value: 'second' },
        { name: 'same', occurrence: '0', value: 'hijacked' }
      ])

      // The string occurrence must not reach occurrence 0's key:
      // `String('0')` is `'0'`, so an unguarded entry would take it.
      expect(
        parsed?.byIdentity.get(widgetIdentityKey('same', 0))
      ).toBeUndefined()
      expect(parsed?.byIdentity.get(widgetIdentityKey('same', 1))).toBe(
        'second'
      )
      expect(parsed?.lastOccurrence.get('same')).toBe(1)
    })

    it('separates the unknown keys from the known triple', () => {
      const parsed = readOrderedWidgetValues([
        { name: 'same', occurrence: 0, value: 'first', source: 'extension' }
      ])

      expect(parsed?.unknownKeys.get(widgetIdentityKey('same', 0))).toEqual({
        source: 'extension'
      })
    })
  })
})
