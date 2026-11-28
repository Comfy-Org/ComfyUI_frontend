import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addValueControlWidgets } from '@/core/graph/widgets/valueControlWidgets'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useApp } from '@/scripts/appInstance'
import { ComfyWidgets } from '@/scripts/widgets'

import { planPrimitiveNodeConversion } from './primitiveNodeConversion'

vi.mock(import('@/scripts/app'))

function registerCoreNode(
  type: string,
  addWidgets: (node: LGraphNode) => void
) {
  LiteGraph.registerNodeType(
    type,
    class extends LGraphNode {
      constructor() {
        super(type)
        addWidgets(this)
      }
    }
  )
}

beforeEach(() => {
  registerCoreNode('PrimitiveFloat', (node) =>
    ComfyWidgets.FLOAT(
      node,
      'value',
      ['FLOAT', { step: 0.1, round: 0.1 }],
      useApp()
    )
  )
  for (const [type, name, min] of [
    ['PrimitiveInt', 'value', -Number.MAX_SAFE_INTEGER],
    ['SeedNode', 'seed', 0]
  ] as const)
    registerCoreNode(type, (node) =>
      ComfyWidgets.INT(
        node,
        name,
        [
          'INT',
          { min, max: Number.MAX_SAFE_INTEGER, control_after_generate: 'fixed' }
        ],
        useApp()
      )
    )
})

function legacyPrimitive(
  type: 'INT' | 'FLOAT',
  value: number,
  options: { min: number; max: number; step2: number },
  mode: string
) {
  const graph = new LGraph()
  const target = new LGraphNode('Target')
  const targetWidget = target.addWidget(
    'number',
    'target',
    0,
    () => {},
    options
  )
  target.addInput('target', type, { widget: { name: targetWidget.name } })
  graph.add(target)

  const primitive = new LGraphNode('Primitive', 'PrimitiveNode')
  primitive.addOutput(type, type)
  const source = primitive.addWidget(
    'number',
    'value',
    value,
    () => {},
    options
  )
  addValueControlWidgets(primitive, source, mode)
  graph.add(primitive)
  primitive.connect(0, target, 0)
  return { graph, primitive, source }
}

describe('planPrimitiveNodeConversion', () => {
  it('leaves a value the core widget would round unchanged', () => {
    const { graph, primitive, source } = legacyPrimitive(
      'FLOAT',
      7.25,
      { min: 0, max: 100, step2: 0.01 },
      'fixed'
    )

    const plan = planPrimitiveNodeConversion(graph, [primitive])

    expect(plan.convertible).toEqual([])
    expect(plan.skipped.map(({ reason }) => reason)).toEqual(['valueChanged'])
    expect(source.value).toBe(7.25)
  })

  it('leaves a non-fixed control mode whose range no core node matches', () => {
    const { graph, primitive } = legacyPrimitive(
      'INT',
      20,
      { min: 1, max: 10000, step2: 1 },
      'increment'
    )

    const plan = planPrimitiveNodeConversion(graph, [primitive])

    expect(plan.convertible).toEqual([])
    expect(plan.skipped.map(({ reason }) => reason)).toEqual(['controlMode'])
  })
})
