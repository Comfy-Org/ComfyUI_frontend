import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, test } from 'vitest'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'

setActivePinia(createPinia())
type DynamicInputs = ('INT' | 'STRING' | 'IMAGE' | DynamicInputs)[][]

const { addNodeInput } = useLitegraphService()

function addDynamicCombo(node: LGraphNode, inputs: DynamicInputs) {
  const namePrefix = `${node.widgets?.length ?? 0}`
  function getSpec(
    inputs: DynamicInputs,
    depth: number = 0
  ): { key: string; inputs: object }[] {
    return inputs.map((group, groupIndex) => {
      const inputs = group.map((input, inputIndex) => [
        `${namePrefix}.${depth}.${inputIndex}`,
        Array.isArray(input)
          ? ['COMFY_DYNAMICCOMBO_V3', { options: getSpec(input, depth + 1) }]
          : [input, {}]
      ])
      return {
        key: `${groupIndex}`,
        inputs: { required: Object.fromEntries(inputs) }
      }
    })
  }
  const inputSpec: Required<InputSpec> = [
    'COMFY_DYNAMICCOMBO_V3',
    { options: getSpec(inputs) }
  ]
  addNodeInput(
    node,
    transformInputSpecV1ToV2(inputSpec, { name: namePrefix, isOptional: false })
  )
}
function testNode() {
  const node: LGraphNode & {
    _initialMinSize?: { width: number; height: number }
  } = new LGraphNode('test')
  node.widgets = []
  node._initialMinSize = { width: 1, height: 1 }
  node.constructor.nodeData = {
    name: 'testnode'
  } as typeof node.constructor.nodeData
  return node as LGraphNode & Required<Pick<LGraphNode, 'widgets'>>
}

describe('Dynamic Combos', () => {
  test('Can add widget on selection', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['INT', 'STRING']])
    expect(node.widgets.length).toBe(2)
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(3)
  })
  test('Can add nested widgets', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], [[[], ['STRING']]]])
    expect(node.widgets.length).toBe(2)
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(2)
    node.widgets[1].value = '1'
    expect(node.widgets.length).toBe(3)
  })
  test('Can add input', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    expect(node.widgets.length).toBe(2)
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(1)
    expect(node.inputs.length).toBe(2)
    expect(node.inputs[1].type).toBe('IMAGE')
  })
  test('Dynamically added inputs are well ordered', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    node.widgets[2].value = '1'
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(2)
    expect(node.inputs.length).toBe(4)
    expect(node.inputs[1].name).toBe('0.0.0')
    expect(node.inputs[3].name).toBe('2.0.0')
  })
})
