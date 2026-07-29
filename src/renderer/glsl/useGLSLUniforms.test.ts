import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

import {
  extractUniformSources,
  toNumber
} from '@/renderer/glsl/useGLSLUniforms'

const { createPromotedHostWidgetIdLookup } = vi.hoisted(() => ({
  createPromotedHostWidgetIdLookup: vi.fn()
}))

vi.mock('@/core/graph/subgraph/promotionUtils', () => ({
  createPromotedHostWidgetIdLookup
}))

function createMockSubgraph(
  links: Record<number, { origin_id: number; origin_slot: number }>,
  nodes: Record<
    number,
    { id: number; widgets: Array<{ name: string; value: unknown }> }
  >
) {
  return fromAny<Subgraph, unknown>({
    getLink: (id: number) => links[id] ?? null,
    getNodeById: (id: number) => nodes[id] ?? null
  })
}

describe('extractUniformSources', () => {
  it('uses origin_slot to select the correct widget from source node', () => {
    const glslNode = fromAny<LGraphNode, unknown>({
      inputs: [
        { name: 'ints.u_int0', link: 1 },
        { name: 'ints.u_int1', link: 2 }
      ]
    })

    const subgraph = createMockSubgraph(
      {
        1: { origin_id: 10, origin_slot: 1 },
        2: { origin_id: 20, origin_slot: 0 }
      },
      {
        10: {
          id: 10,
          widgets: [
            { name: 'choice', value: 'Master' },
            { name: 'index', value: 0 }
          ]
        },
        20: {
          id: 20,
          widgets: [{ name: 'value', value: 42 }]
        }
      }
    )

    const result = extractUniformSources(glslNode, subgraph)

    expect(result.ints[0].widgetName).toBe('index')
    expect(result.ints[1].widgetName).toBe('value')
  })

  it('skips source when origin_slot exceeds widget count', () => {
    const glslNode = fromAny<LGraphNode, unknown>({
      inputs: [{ name: 'floats.u_float0', link: 1 }]
    })

    const subgraph = createMockSubgraph(
      { 1: { origin_id: 10, origin_slot: 5 } },
      { 10: { id: 10, widgets: [{ name: 'value', value: 3.14 }] } }
    )

    const result = extractUniformSources(glslNode, subgraph)

    expect(result.floats).toHaveLength(0)
  })

  it('provides directValue getter that reads from the widget', () => {
    const indexWidget = {
      name: 'index',
      get value() {
        return choiceWidget.value === 'Reds' ? 1 : 0
      }
    }
    const choiceWidget = { name: 'choice', value: 'Master' }

    const glslNode = fromAny<LGraphNode, unknown>({
      inputs: [{ name: 'ints.u_int0', link: 1 }]
    })

    const subgraph = createMockSubgraph(
      { 1: { origin_id: 10, origin_slot: 1 } },
      { 10: { id: 10, widgets: [choiceWidget, indexWidget] } }
    )

    const result = extractUniformSources(glslNode, subgraph)

    expect(result.ints[0].directValue()).toBe(0)

    choiceWidget.value = 'Reds'
    expect(result.ints[0].directValue()).toBe(1)
  })

  it('leaves hostWidgetId undefined when no subgraphNode is given', () => {
    const glslNode = fromAny<LGraphNode, unknown>({
      inputs: [{ name: 'curves.u_curve0', link: 1 }]
    })
    const subgraph = createMockSubgraph(
      { 1: { origin_id: 10, origin_slot: 0 } },
      { 10: { id: 10, widgets: [{ name: 'curve', value: {} }] } }
    )

    const result = extractUniformSources(glslNode, subgraph)

    expect(result.curves[0].hostWidgetId).toBeUndefined()
  })

  it('resolves hostWidgetId from the promoted host input when subgraphNode is given', () => {
    createPromotedHostWidgetIdLookup.mockReturnValueOnce(
      (sourceNodeId: number, widgetName: string) =>
        sourceNodeId === 10 && widgetName === 'curve'
          ? 'graph:99:curve0'
          : undefined
    )

    const glslNode = fromAny<LGraphNode, unknown>({
      inputs: [{ name: 'curves.u_curve0', link: 1 }]
    })
    const subgraph = createMockSubgraph(
      { 1: { origin_id: 10, origin_slot: 0 } },
      { 10: { id: 10, widgets: [{ name: 'curve', value: {} }] } }
    )
    const subgraphNode = fromAny<SubgraphNode, unknown>({ id: 99 })

    const result = extractUniformSources(glslNode, subgraph, subgraphNode)

    expect(result.curves[0].hostWidgetId).toBe('graph:99:curve0')
  })
})

describe('toNumber', () => {
  it('coerces hex color strings via hexToInt', () => {
    expect(toNumber('#45edf5')).toBe(0x45edf5)
  })

  it('coerces plain numeric values', () => {
    expect(toNumber(42)).toBe(42)
    expect(toNumber('10')).toBe(10)
  })

  it('returns 0 for non-numeric strings', () => {
    expect(toNumber('Master')).toBe(0)
  })
})
