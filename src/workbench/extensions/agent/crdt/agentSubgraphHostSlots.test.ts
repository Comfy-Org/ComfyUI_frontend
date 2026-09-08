import { describe, expect, it } from 'vitest'

import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'

import {
  hostInputs,
  hostSlotIndex,
  indexSubgraphDefinitions,
  promotedWidgetNames
} from './agentSubgraphHostSlots'

/**
 * Definition with `extra` declared before `value`. Only `value` lands on an
 * interior input that carries a widget; `extra` feeds a plain slot and
 * `dangling` has no links at all.
 */
function definition(): ExportedSubgraph {
  return {
    id: 'sg-1',
    version: 1,
    state: { lastGroupId: 0, lastNodeId: 2, lastLinkId: 2, lastRerouteId: 0 },
    revision: 0,
    config: {},
    name: 'sg',
    inputNode: { id: -10, bounding: [0, 0, 0, 0] },
    outputNode: { id: -20, bounding: [0, 0, 0, 0] },
    inputs: [
      { id: 'in-extra', name: 'extra', type: 'NUMBER', linkIds: [1] },
      { id: 'in-value', name: 'value', type: 'NUMBER', linkIds: [2] },
      { id: 'in-dangling', name: 'dangling', type: 'NUMBER' }
    ],
    outputs: [],
    widgets: [],
    nodes: [
      {
        id: 1,
        type: 'plain',
        pos: [0, 0],
        size: [1, 1],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [{ name: 'extra', type: 'NUMBER', link: 1 }]
      },
      {
        id: 2,
        type: 'promoted-widget',
        pos: [0, 0],
        size: [1, 1],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          { name: 'value', type: 'NUMBER', link: 2, widget: { name: 'value' } }
        ]
      }
    ],
    links: [
      {
        id: 1,
        origin_id: -10,
        origin_slot: 0,
        target_id: 1,
        target_slot: 0,
        type: 'NUMBER'
      },
      {
        id: 2,
        origin_id: -10,
        origin_slot: 1,
        target_id: 2,
        target_slot: 0,
        type: 'NUMBER'
      }
    ],
    groups: [],
    extra: {}
  } as unknown as ExportedSubgraph
}

describe('agentSubgraphHostSlots', () => {
  it('indexes definitions by string id', () => {
    const def = definition()
    const index = indexSubgraphDefinitions([def])
    expect(index.get('sg-1')).toBe(def)
    expect(index.has('sg-2')).toBe(false)
  })

  it('indexes definitions nested under an outer definition', () => {
    const nested = { ...definition(), id: 'sg-nested' }
    const outer = {
      ...definition(),
      definitions: { subgraphs: [nested] }
    }
    const index = indexSubgraphDefinitions([outer])
    expect(index.get('sg-1')).toBe(outer)
    expect(index.get('sg-nested')).toBe(nested)
  })

  it('keeps the first definition when a nested one repeats an id', () => {
    const shadow = { ...definition(), name: 'shadow' }
    const outer = {
      ...definition(),
      id: 'sg-outer',
      definitions: { subgraphs: [shadow] }
    }
    const first = definition()
    const index = indexSubgraphDefinitions([first, outer])
    expect(index.get('sg-1')).toBe(first)
  })

  it('treats duplicate declared input names as ambiguous', () => {
    const base = definition()
    const def: ExportedSubgraph = {
      ...base,
      inputs: [
        ...(base.inputs ?? []),
        { id: 'in-value-2', name: 'value', type: 'NUMBER' }
      ]
    }
    expect(hostSlotIndex(def, 'value')).toBe(-1)
    expect(hostSlotIndex(def, 'extra')).toBe(0)
    const inputs = hostInputs(def, [{ name: 'value', type: 'NUMBER', link: 9 }])
    expect(inputs.map((input) => input.name)).toEqual([
      'extra',
      'value',
      'dangling',
      'value'
    ])
    expect(inputs.map((input) => input.link)).toEqual([null, null, null, null])
  })

  it('reports only inputs linked to a widget-bearing interior slot, in order', () => {
    expect(promotedWidgetNames(definition())).toEqual(['value'])
  })

  it('resolves host slot index from definition order, not doc order', () => {
    const def = definition()
    expect(hostSlotIndex(def, 'extra')).toBe(0)
    expect(hostSlotIndex(def, 'value')).toBe(1)
    expect(hostSlotIndex(def, 'missing')).toBe(-1)
  })

  it('expands a single-entry doc input list to the full declared slot list', () => {
    // cmp writes only the grown slot after a promoted connect; the doc says
    // `value` sits at index 0 but the host's real slot for `value` is 1.
    const inputs = hostInputs(definition(), [
      { name: 'value', type: 'NUMBER', link: 9 }
    ])
    expect(inputs.map((input) => input.name)).toEqual([
      'extra',
      'value',
      'dangling'
    ])
    expect(inputs[0].link).toBeNull()
    expect(inputs[1].link).toBe(9)
    expect(inputs[2].link).toBeNull()
  })

  it('returns no slots for a definition without inputs', () => {
    const def = { ...definition(), inputs: undefined } as ExportedSubgraph
    expect(hostInputs(def, [])).toEqual([])
    expect(promotedWidgetNames(def)).toEqual([])
  })
})
