import { describe, expect, it } from 'vitest'

import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'

import {
  hostInputs,
  hostSlotIndex,
  indexSubgraphDefinitions,
  promotedWidgetNames
} from './agentSubgraphHostSlots'

/** Definition whose interior `nodes` are known to be present. */
type DefinitionWithNodes = ExportedSubgraph & {
  nodes: NonNullable<ExportedSubgraph['nodes']>
}

/**
 * Definition with `extra` declared before `value`. Only `value` lands on an
 * interior input that carries a widget; `extra` feeds a plain slot and
 * `dangling` has no links at all.
 */
function definition(): DefinitionWithNodes {
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
  } as unknown as DefinitionWithNodes
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
    // No slot is unlinked outright: an ambiguous or omitted declared slot
    // leaves `link` undefined so the mutation layer keeps the live link.
    expect(inputs.map((input) => input.link)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined
    ])
    expect(inputs.every((input) => !('link' in input))).toBe(true)
  })

  it('reports only inputs linked to a widget-bearing interior slot, in order', () => {
    const def = definition()
    expect(promotedWidgetNames(def, indexSubgraphDefinitions([def]))).toEqual([
      'value'
    ])
  })

  /**
   * Outer definition whose `extra` input feeds a nested subgraph instance
   * (node 1 typed `sg-1`) on its `value` input. The nested definition promotes
   * `value` to a widget, so the outer `extra` is widget-backed through the
   * nested instance even though node 1's own input entry carries no `widget`
   * marker (`SubgraphNode._resolveNestedPromotedSource`, comfy-cli
   * `promoted_inputs`). The nested instance's own `value` slot has no widget
   * marker in the outer definition, so `extra` must precede `value` in the
   * positional `__widgets_opaque` order.
   */
  function outerWithNestedInstance(): DefinitionWithNodes {
    const base = definition()
    return {
      ...base,
      id: 'sg-outer',
      nodes: [
        {
          ...base.nodes[0],
          type: 'sg-1',
          inputs: [{ name: 'value', type: 'NUMBER', link: 1 }]
        },
        base.nodes[1]
      ]
    }
  }

  it('counts an input promoted through a nested instance as widget-backed', () => {
    const outer = outerWithNestedInstance()
    const index = indexSubgraphDefinitions([outer, definition()])
    expect(promotedWidgetNames(outer, index)).toEqual(['extra', 'value'])
  })

  it('does not count a nested-instance input the nested definition leaves unpromoted', () => {
    const outer = outerWithNestedInstance()
    const nested = definition()
    // Point the nested link at `extra`, which lands on a plain slot inside.
    outer.nodes[0].inputs = [{ name: 'extra', type: 'NUMBER', link: 1 }]
    const index = indexSubgraphDefinitions([outer, nested])
    expect(promotedWidgetNames(outer, index)).toEqual(['value'])
  })

  it('treats a nested instance whose definition is missing as unpromoted', () => {
    const outer = outerWithNestedInstance()
    const index = indexSubgraphDefinitions([outer])
    expect(promotedWidgetNames(outer, index)).toEqual(['value'])
  })

  it('terminates when nested definitions reference each other cyclically', () => {
    const outer = outerWithNestedInstance()
    // `sg-1` in turn hosts an `sg-outer` instance on its promoted `value` link.
    const nested = definition()
    nested.nodes[1] = {
      ...nested.nodes[1],
      type: 'sg-outer',
      inputs: [{ name: 'extra', type: 'NUMBER', link: 2 }]
    }
    const index = indexSubgraphDefinitions([outer, nested])
    // `extra` chases the cycle until the depth cap and stays unpromoted;
    // `value` still lands on a real widget marker inside `sg-outer`.
    expect(promotedWidgetNames(outer, index)).toEqual(['value'])
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
    // Slots the doc omits are left without a `link` key so the mutation
    // layer preserves whatever live link the host already carries there.
    expect('link' in inputs[0]).toBe(false)
    expect(inputs[1].link).toBe(9)
    expect('link' in inputs[2]).toBe(false)
  })

  it('carries declared slot fields onto host inputs, letting doc fields override', () => {
    const def = definition()
    def.inputs![0] = {
      ...def.inputs![0],
      label: 'Extra label',
      shape: RenderShape.GRID,
      localized_name: 'Extra'
    }
    def.inputs![1] = { ...def.inputs![1], label: 'Definition label' }
    const inputs = hostInputs(def, [
      { name: 'value', type: 'NUMBER', link: 9, label: 'Doc label' }
    ])
    expect(inputs[0]).toMatchObject({
      name: 'extra',
      type: 'NUMBER',
      label: 'Extra label',
      shape: RenderShape.GRID,
      localized_name: 'Extra'
    })
    // definition-only bookkeeping never leaks onto a live host slot
    expect('id' in inputs[0]).toBe(false)
    expect('linkIds' in inputs[0]).toBe(false)
    expect(inputs[1]).toMatchObject({
      name: 'value',
      link: 9,
      label: 'Doc label'
    })
  })

  it('returns no slots for a definition without inputs', () => {
    const def: ExportedSubgraph = { ...definition(), inputs: undefined }
    expect(hostInputs(def, [])).toEqual([])
    expect(promotedWidgetNames(def, indexSubgraphDefinitions([def]))).toEqual(
      []
    )
  })
})
