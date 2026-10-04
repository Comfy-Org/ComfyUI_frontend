import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createWidgetRestorationState } from '@/lib/litegraph/src/LGraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

/**
 * `fallbackWidgetsValuesNames` names each slot of the *legacy* `widgets_values`
 * order so a workflow saved before `widgets_values_named` existed can still be
 * restored by name. Presence of the list also opts the node into named
 * restoration while the user setting is off.
 *
 * Named restoration never consults `positional` per widget, so a derived
 * register that no live widget can read does not leave the node alone — it
 * switches the node into named mode and resets every widget to its default,
 * discarding the saved workflow. These cases draw the line in both directions:
 *
 * - a register with **no live reader** must not be derived at all, and
 * - a register with one must still place the slots it names **by name**, because
 *   the list is only useful when the current widget order differs from the
 *   legacy order.
 *
 * The slots the list leaves unnamed are deliberately *not* filled. The last
 * group pins that as a known limitation rather than leaving it undocumented:
 * every mechanism for filling them was measured to hand some widget another
 * widget's value.
 */
const originalNamedValuesRestore = LiteGraph.namedValuesRestore

function mockNode(
  widgets_values?: TWidgetValue[],
  widgets_values_named?: Record<string, TWidgetValue>
): ISerialisedNode {
  return {
    id: 1,
    type: 'TestNode',
    pos: [0, 0],
    size: [200, 100],
    flags: {},
    order: 0,
    mode: 0,
    widgets_values,
    widgets_values_named
  }
}

function withFallbackNames(node: LGraphNode, names: unknown[]): void {
  const nodeData = fromPartial({ fallbackWidgetsValuesNames: names })
  node.constructor = Object.assign({}, node.constructor, { nodeData })
}

function widgetValues(node: LGraphNode): TWidgetValue[] {
  return node.widgets!.map((widget) => widget.value)
}

describe('fallback widget-name coverage', () => {
  let node: LGraphNode

  beforeEach(() => {
    LiteGraph.namedValuesRestore = false
    node = new LGraphNode('TestNode')
  })

  afterEach(() => {
    LiteGraph.namedValuesRestore = originalNamedValuesRestore
  })

  describe('a register with no live reader is not derived at all', () => {
    it('keeps every legacy value when the fallback list is empty', () => {
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, [])

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([12345, 37])
    })

    it('keeps every legacy value when the list is all holes', () => {
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, ['', ''])

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([12345, 37])
    })

    it('keeps every legacy value when no name in the list matches a live widget', () => {
      // The upstream definition renamed its widgets without updating the list,
      // so every derived key is a dead name. This is a total-loss case on the
      // unmodified code: the register is non-empty, so named mode engages and
      // no widget finds itself in it.
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      withFallbackNames(node, ['n_steps', 'noise_seed'])

      node.configure(mockNode([37, 12345]))

      expect(widgetValues(node)).toStrictEqual([37, 12345])
    })

    it('keeps both legacy values when the list names one widget twice', () => {
      // The register holds one value per name, so attributing either slot to
      // `seed` would drop the other. Neither is attributed, which leaves no
      // live reader and no derivation.
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, ['seed', 'seed'])

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([12345, 37])
    })

    it('reports an empty list as declaring no derivable register', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: [12345, 37] },
        [],
        ['seed', 'steps']
      )

      expect(restoration).toStrictEqual({
        positional: [12345, 37],
        named: undefined,
        restoreNamed: false
      })
    })

    it('does not let the user setting force a register with no live reader', () => {
      LiteGraph.namedValuesRestore = true

      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345] },
        ['n_steps', 'noise_seed'],
        ['steps', 'seed']
      )

      expect(restoration).toStrictEqual({
        positional: [37, 12345],
        named: undefined,
        restoreNamed: false
      })
    })
  })

  describe('the slots the list does name are placed by name', () => {
    it('places a short list by name across a reorder instead of by index', () => {
      // The list's whole purpose: the live order is steps, seed while the
      // legacy order was seed, steps, and the legacy register carried a third
      // slot nothing names any more. Restoring this node positionally — which
      // is what refusing to derive on incomplete coverage does — reads
      // steps = 12345 and seed = 37.
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      withFallbackNames(node, ['seed', 'steps'])

      node.configure(mockNode([12345, 37, 'orphan']))

      expect(widgetValues(node)).toStrictEqual([37, 12345])
    })

    it('derives a full register and restores across a reorder', () => {
      // Green before the change as well as after.
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      withFallbackNames(node, ['seed', 'steps'])

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([37, 12345])
    })

    it('still derives when the list names more slots than the register carries', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: [12345, 37] },
        ['seed', 'steps', 'cfg'],
        ['seed', 'steps', 'cfg']
      )

      expect(restoration).toStrictEqual({
        positional: [12345, 37],
        named: { seed: 12345, steps: 37 },
        restoreNamed: true
      })
    })

    it('derives on one live name and keeps the dead ones in the register', () => {
      // A name matching nothing live is not filtered out: a widget created
      // later in `configure` reads this register by name, and it is not in the
      // snapshot `widgetNames` was taken from.
      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345] },
        ['steps', 'added_later'],
        ['steps']
      )

      expect(restoration).toStrictEqual({
        positional: [37, 12345],
        named: { steps: 37, added_later: 12345 },
        restoreNamed: true
      })
    })

    it('runs attribution alone when the live widget names are unknown', () => {
      // `widgetInputs` restores a single value before any widget exists, so it
      // has no name list to offer.
      const restoration = createWidgetRestorationState(
        { widgets_values: [12345, 37, 6] },
        ['seed', 'steps']
      )

      expect(restoration).toStrictEqual({
        positional: [12345, 37, 6],
        named: { seed: 12345, steps: 37 },
        restoreNamed: true
      })
    })
  })

  describe('unvalidated `/object_info` input', () => {
    it('treats a non-string entry as a hole rather than coercing it to a key', () => {
      // `readonly string[]` is not a runtime guarantee. `1` and `'1'` both
      // become the key `'1'` under `Object.fromEntries`, so counting uses on
      // the raw values would see two distinct names and silently collapse them
      // onto one entry.
      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345] },
        [1, '1'] as unknown as readonly string[],
        ['1', 'seed']
      )

      expect(restoration).toStrictEqual({
        positional: [37, 12345],
        named: { '1': 12345 },
        restoreNamed: true
      })
    })

    it('makes a `__proto__` name an own property of the register', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: [5] },
        ['__proto__']
      )

      expect(Object.hasOwn(restoration.named!, '__proto__')).toBe(true)
      expect(restoration.named!['__proto__']).toBe(5)
    })

    it('takes no positional values from a name-keyed `widgets_values` record', () => {
      // Only the clipboard schemas normalize the record form, so it reaches
      // here as-is. Reading its `length` is both wrong and unbounded, and an
      // empty register derived from it would still switch the node into named
      // mode.
      const restoration = createWidgetRestorationState(
        { widgets_values: { seed: 12345, steps: 37 } } as unknown as {
          widgets_values?: TWidgetValue[]
        },
        ['seed', 'steps'],
        ['seed', 'steps']
      )

      expect(restoration).toStrictEqual({
        positional: [],
        named: undefined,
        restoreNamed: false
      })
    })

    it('does not materialise an array from an unbounded array-like `length`', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: { length: 1_000_000_000 } } as unknown as {
          widgets_values?: TWidgetValue[]
        },
        ['seed'],
        ['seed']
      )

      expect(restoration.positional).toStrictEqual([])
    })
  })

  describe('the opt-in and the supplied register are untouched', () => {
    it('still lets an empty list activate a supplied named register', () => {
      const restoration = createWidgetRestorationState(
        {
          widgets_values: [111, 12],
          widgets_values_named: { seed: 987654321, steps: 37 }
        },
        []
      )

      expect(restoration).toStrictEqual({
        positional: [111, 12],
        named: { seed: 987654321, steps: 37 },
        restoreNamed: true
      })
    })

    it('still lets a short list activate a supplied named register', () => {
      const restoration = createWidgetRestorationState(
        {
          widgets_values: [111, 12, 8],
          widgets_values_named: { seed: 987654321, steps: 37, cfg: 6 }
        },
        ['seed']
      )

      expect(restoration).toStrictEqual({
        positional: [111, 12, 8],
        named: { seed: 987654321, steps: 37, cfg: 6 },
        restoreNamed: true
      })
    })

    it('leaves a node that ships no fallback list on the positional path', () => {
      const restoration = createWidgetRestorationState({
        widgets_values: [12345, 37]
      })

      expect(restoration).toStrictEqual({
        positional: [12345, 37],
        named: undefined,
        restoreNamed: false
      })
    })
  })

  describe('known limitation: an unnamed slot is not guessed at', () => {
    it('leaves the unnamed tail of a short list on node defaults', () => {
      // Not a desirable outcome, and deliberately not fixed here. Filling these
      // widgets from the slot at their own index assumes the current index is
      // the legacy index, which is the one thing the list's existence denies.
      // The fix is a node definition that names every slot.
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'cfg', 8, null, {})
      node.addWidget('number', 'denoise', 1, null, {})
      withFallbackNames(node, ['steps', 'seed'])

      node.configure(mockNode([37, 12345, 6, 0.75]))

      expect(widgetValues(node)).toStrictEqual([37, 12345, 8, 1])
    })

    it('leaves a widget under a hole in the list on its default', () => {
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'cfg', 8, null, {})
      withFallbackNames(node, ['steps', '', 'cfg'])

      node.configure(mockNode([37, 12345, 6]))

      expect(widgetValues(node)).toStrictEqual([37, 0, 6])
    })

    it('never hands one legacy slot to two widgets', () => {
      // Slot 0 belongs to `b` by name. `a` sits at index 0 and has no
      // attributed slot; handing it slot 0 as well would deliver 9 twice and
      // still lose 8.
      node.addWidget('number', 'a', 1, null, {})
      node.addWidget('number', 'b', 2, null, {})
      withFallbackNames(node, ['b'])

      node.configure(mockNode([9, 8]))

      expect(widgetValues(node)).toStrictEqual([1, 9])
    })

    it('leaves two widgets sharing a name on the positional path', () => {
      // A named register cannot address them separately, so nothing attributes
      // and the positional path — which can — is what restores them.
      node.addWidget('number', 'scale', 0, null, {})
      node.addWidget('number', 'scale', 0, null, {})
      withFallbackNames(node, ['', ''])

      node.configure(mockNode([5, 7]))

      expect(widgetValues(node)).toStrictEqual([5, 7])
    })
  })
})
