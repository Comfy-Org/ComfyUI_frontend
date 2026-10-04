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
 * Named restoration never consults `positional` per widget, so a register that
 * names nothing does not leave the node alone: it is truthy, so it switches the
 * node into named mode and every widget falls to its constructor default. A
 * list that said nothing therefore discards the whole saved workflow. That is
 * the one case corrected here.
 *
 * A list that names *some* slots is not corrected — those slots restore by
 * name, and the rest keep their defaults. The last group pins that as a known
 * limitation rather than leaving it undocumented, because every mechanism for
 * filling the unnamed slots was measured to hand some widget another widget's
 * value.
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

function withFallbackNames(node: LGraphNode, names: unknown): void {
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

  describe('a list that names nothing does not become a register', () => {
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

    it('keeps every legacy value when the list is all non-strings', () => {
      // `/object_info` is unvalidated, so the entries may not be strings at
      // all. A number names no slot.
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, [0, 1])

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([12345, 37])
    })

    it('keeps both legacy values when the list names one widget twice', () => {
      // The register holds one value per name, so attributing either slot to
      // `seed` would drop the other. Neither is attributed, so nothing is.
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, ['seed', 'seed'])

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([12345, 37])
    })

    it('keeps every legacy value when the list is not an array at all', () => {
      // A bare string is indexable, so without the array check each character
      // would name a slot and the node would opt in on a register of letters.
      node.addWidget('number', 's', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, 'steps')

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([12345, 37])
    })

    it('reports an empty list as declaring no derivable register', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: [12345, 37] },
        []
      )

      expect(restoration).toStrictEqual({
        positional: [12345, 37],
        named: undefined,
        restoreNamed: false
      })
    })

    it('does not let the user setting turn a register of nothing on', () => {
      LiteGraph.namedValuesRestore = true

      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345] },
        ['', '']
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
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      withFallbackNames(node, ['seed', 'steps'])

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([37, 12345])
    })

    it('still derives when the list names more slots than the register carries', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: [12345, 37] },
        ['seed', 'steps', 'cfg']
      )

      expect(restoration).toStrictEqual({
        positional: [12345, 37],
        named: { seed: 12345, steps: 37 },
        restoreNamed: true
      })
    })

    it('keeps a name no widget bears yet, for a widget created later', () => {
      // Liveness is not a derivation condition: these names are how a widget
      // added during `configure` — by a value setter, `onConfigure`, or
      // `addCustomWidget` — finds its value, and any liveness test could only
      // be taken before those run.
      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345] },
        ['steps', 'added_later']
      )

      expect(restoration).toStrictEqual({
        positional: [37, 12345],
        named: { steps: 37, added_later: 12345 },
        restoreNamed: true
      })
    })

    it('treats a non-string entry as a hole rather than coercing it to a key', () => {
      // `1` and `'1'` both become the key `'1'` under `Object.fromEntries`, so
      // counting uses on the raw entries would see two distinct names and
      // silently collapse them onto one.
      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345] },
        [1, '1']
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

    it('gives a supplied named register no positional fallback', () => {
      // A widget the workflow's own `widgets_values_named` omits did not exist
      // when the workflow was saved, so the slot at its index belongs to some
      // other widget.
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, ['seed', 'steps'])

      node.configure(mockNode([12345, 37], { seed: 987654321 }))

      expect(widgetValues(node)).toStrictEqual([987654321, 20])
    })
  })

  describe('known limitation: a slot the list does not name is not guessed at', () => {
    it('leaves the unnamed tail of a short list on node defaults', () => {
      // Not a desirable outcome, and deliberately not fixed here. Every way of
      // filling these widgets assumes a current index is a legacy index, which
      // is the one thing the list's existence denies. The fix is a node
      // definition that names every slot.
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

    it('leaves a widget on its default when one duplicate pair still names a third slot', () => {
      // The duplicated `seed` is unattributable, but `steps` is not, so the
      // node does derive and `seed` keeps its default. Asserted because the
      // "all duplicates" case above reads as if duplicates were always safe.
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, ['seed', 'seed', 'steps'])

      node.configure(mockNode([12345, 999, 37]))

      expect(widgetValues(node)).toStrictEqual([0, 37])
    })

    it('leaves every static widget on its default when the list names only a later-created one', () => {
      // The register is kept for the widget that does not exist yet, so the
      // static widgets get nothing. Restoring them positionally instead would
      // read the legacy order the list was written to repair.
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, ['added_later'])

      node.configure(mockNode([12345]))

      expect(widgetValues(node)).toStrictEqual([20])
    })

    it('leaves two widgets sharing a name on the positional path', () => {
      // Nothing is attributable, so the positional path — which can address
      // them separately, as a single register key cannot — is what restores.
      node.addWidget('number', 'scale', 0, null, {})
      node.addWidget('number', 'scale', 0, null, {})
      withFallbackNames(node, ['', ''])

      node.configure(mockNode([5, 7]))

      expect(widgetValues(node)).toStrictEqual([5, 7])
    })
  })
})
