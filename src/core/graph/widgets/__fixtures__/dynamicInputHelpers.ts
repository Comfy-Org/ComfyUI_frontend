import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import { useLitegraphService } from '@/services/litegraphService'

type DynamicInputs = ('INT' | 'STRING' | 'IMAGE' | DynamicInputs)[][]

export function addDynamicCombo(node: LGraphNode, inputs: DynamicInputs) {
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
          : [input, { tooltip: `${groupIndex}` }]
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
  useLitegraphService().addNodeInput(
    node,
    transformInputSpecV1ToV2(inputSpec, { name: namePrefix, isOptional: false })
  )
}

export function addAutogrow(node: LGraphNode, template: unknown) {
  useLitegraphService().addNodeInput(
    node,
    transformInputSpecV1ToV2(['COMFY_AUTOGROW_V3', { template }], {
      name: `${node.inputs.length}`,
      isOptional: false
    })
  )
}
