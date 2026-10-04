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
 * register has to account for every widget that has a saved value: a widget the
 * register omits keeps its constructor default and the saved value is gone.
 * These cases cover a list that does not cleanly name the register it is
 * applied to, from both directions at once —
 *
 * - the unnamed remainder must still be restored (a short, holed, duplicated or
 *   stale list must not discard the rest of the workflow), and
 * - the slots the list *does* name must still be placed by name, because the
 *   list is only useful when the current widget order differs from the legacy
 *   order. Restoring such a node positionally instead swaps those values.
 *
 * Several cases below hold on both the pre-change code and the change, and are
 * marked as such: they are the ones that fail if the fix is taken too far.
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

  describe('a list that does not name a slot leaves it on the positional path', () => {
    it('keeps every legacy value when the fallback list is empty', () => {
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, [])

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([12345, 37])
    })

    it('keeps the unnamed tail when the fallback list is shorter than the register', () => {
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'cfg', 8, null, {})
      node.addWidget('number', 'denoise', 1, null, {})
      withFallbackNames(node, ['steps', 'seed'])

      node.configure(mockNode([37, 12345, 6, 0.75]))

      expect(widgetValues(node)).toStrictEqual([37, 12345, 6, 0.75])
    })

    it('keeps the slot under a hole, not only a missing tail', () => {
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'cfg', 8, null, {})
      withFallbackNames(node, ['steps', '', 'cfg'])

      node.configure(mockNode([37, 12345, 6]))

      expect(widgetValues(node)).toStrictEqual([37, 12345, 6])
    })

    it('keeps every legacy value when no name in the list matches a live widget', () => {
      // The upstream definition renamed its widgets without updating the list.
      // Every derived key is then a dead name, so the register can restore
      // nothing and must not take the slots away from the positional path.
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      withFallbackNames(node, ['n_steps', 'noise_seed'])

      node.configure(mockNode([37, 12345]))

      expect(widgetValues(node)).toStrictEqual([37, 12345])
    })

    it('keeps both legacy values when the list names one widget twice', () => {
      // The register holds one value per name, so attributing either slot to
      // `seed` would drop the other without a trace. Neither is attributed.
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, ['seed', 'seed'])

      node.configure(mockNode([12345, 37]))

      expect(widgetValues(node)).toStrictEqual([12345, 37])
    })

    it('leaves a widget with no slot at its index on its default', () => {
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'added_later', 7, null, {})
      withFallbackNames(node, ['seed'])

      node.configure(mockNode([12345]))

      expect(widgetValues(node)).toStrictEqual([12345, 7])
    })
  })

  describe('the slots the list does name are still placed by name', () => {
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

    it('never hands one legacy slot to two widgets', () => {
      // Slot 0 belongs to `b` by name. `a` is at index 0 but has no attributed
      // slot, and must not also collect slot 0 — that would deliver 9 twice
      // and still lose 8.
      node.addWidget('number', 'a', 1, null, {})
      node.addWidget('number', 'b', 2, null, {})
      withFallbackNames(node, ['b'])

      node.configure(mockNode([9, 8]))

      expect(widgetValues(node)).toStrictEqual([1, 9])
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
        ['seed', 'steps', 'cfg']
      )

      expect(restoration).toStrictEqual({
        positional: [12345, 37],
        named: { seed: 12345, steps: 37 },
        restoreNamed: true
      })
    })
  })

  describe('the derived register, asserted directly', () => {
    it('fills only the slots attribution left free', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: [12345, 37, 6, 0.75] },
        ['seed', 'steps'],
        ['steps', 'seed', 'cfg', 'denoise']
      )

      expect(restoration).toStrictEqual({
        positional: [12345, 37, 6, 0.75],
        // `seed`/`steps` by name from slots 0/1; `cfg`/`denoise` positionally
        // from the slots nothing named.
        named: { seed: 12345, steps: 37, cfg: 6, denoise: 0.75 },
        restoreNamed: true
      })
    })

    it('runs attribution only when the live widget names are unknown', () => {
      // `widgetInputs` restores a single value before any widget exists, so it
      // has no name list to offer. Attribution alone is the pre-change shape.
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

    it('treats a non-string entry as a hole rather than coercing it to a key', () => {
      // `/object_info` is unvalidated, so `readonly string[]` is not a runtime
      // guarantee. `1` and `'1'` both become the key `'1'` under
      // `Object.fromEntries`, so counting uses on the raw values would see two
      // distinct names and silently collapse them onto one entry.
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

    it('gives a supplied named register no positional fallback', () => {
      // A widget the workflow's own `widgets_values_named` omits did not exist
      // when the workflow was saved, so the slot at its index belongs to some
      // other widget. The positional fill is for a *derived* register only.
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, ['seed', 'steps'])

      node.configure(mockNode([12345, 37], { seed: 987654321 }))

      expect(widgetValues(node)).toStrictEqual([987654321, 20])
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

    it('derives the same register whether or not the user setting is on', () => {
      LiteGraph.namedValuesRestore = true

      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345, 6] },
        ['steps', 'seed'],
        ['steps', 'seed', 'cfg']
      )

      expect(restoration).toStrictEqual({
        positional: [37, 12345, 6],
        named: { steps: 37, seed: 12345, cfg: 6 },
        restoreNamed: true
      })
    })
  })
})
