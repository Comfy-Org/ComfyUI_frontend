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
 * These cases cover what happens when the list does not actually name the
 * register it is applied to. Named restoration never consults `positional`, so
 * a derived register that is missing a slot does not fall back for that widget —
 * the widget keeps its node default and the saved value is gone.
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

function withFallbackNames(node: LGraphNode, names: string[]): void {
  const nodeData = fromPartial({ fallbackWidgetsValuesNames: names })
  node.constructor = Object.assign({}, node.constructor, { nodeData })
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

  describe('derivation is refused unless the list names every saved slot', () => {
    it('keeps every legacy value when the fallback list is empty', () => {
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 20, null, {})
      withFallbackNames(node, [])

      node.configure(mockNode([12345, 37]))

      expect(node.widgets!.map((widget) => widget.value)).toStrictEqual([
        12345, 37
      ])
    })

    it('keeps the unnamed tail when the fallback list is shorter than the register', () => {
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'cfg', 8, null, {})
      node.addWidget('number', 'denoise', 1, null, {})
      withFallbackNames(node, ['steps', 'seed'])

      node.configure(mockNode([37, 12345, 6, 0.75]))

      expect(node.widgets!.map((widget) => widget.value)).toStrictEqual([
        37, 12345, 6, 0.75
      ])
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

    it('reports a short list as declaring no derivable register', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345, 6] },
        ['steps', 'seed']
      )

      expect(restoration).toStrictEqual({
        positional: [37, 12345, 6],
        named: undefined,
        restoreNamed: false
      })
    })

    it('refuses a list with a hole, not only a missing tail', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345, 6] },
        ['steps', '', 'cfg']
      )

      expect(restoration).toStrictEqual({
        positional: [37, 12345, 6],
        named: undefined,
        restoreNamed: false
      })
    })

    it('refuses a list that names one widget twice, because one value would be lost', () => {
      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345] },
        ['seed', 'seed']
      )

      expect(restoration).toStrictEqual({
        positional: [37, 12345],
        named: undefined,
        restoreNamed: false
      })
    })

    it('does not let the user setting bypass the coverage requirement', () => {
      LiteGraph.namedValuesRestore = true

      const restoration = createWidgetRestorationState(
        { widgets_values: [37, 12345, 6] },
        ['steps', 'seed']
      )

      expect(restoration).toStrictEqual({
        positional: [37, 12345, 6],
        named: undefined,
        restoreNamed: false
      })
    })
  })

  describe('coverage gates derivation only, never the opt-in', () => {
    it('still derives a full register and restores across a reorder', () => {
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      withFallbackNames(node, ['seed', 'steps'])

      node.configure(mockNode([12345, 37]))

      expect(node.widgets!.map((widget) => widget.value)).toStrictEqual([
        37, 12345
      ])
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
})
