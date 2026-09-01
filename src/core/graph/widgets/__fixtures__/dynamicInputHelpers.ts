import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import { useLitegraphService } from '@/services/litegraphService'

type MockInputs = ('INT' | 'STRING' | 'IMAGE' | MockInputs)[][]

export function addDynamicCombo(node: LGraphNode, rootMockInputs: MockInputs) {
  const namePrefix = `${node.widgets?.length ?? 0}`
  function getSpec(
    mockInputs: MockInputs,
    depth: number = 0
  ): { key: string; inputs: object }[] {
    return mockInputs.map((mockGroup, groupIndex) => {
      const inputSpec = mockGroup.map((mockInput, inputIndex) => [
        `${namePrefix}.${depth}.${inputIndex}`,
        Array.isArray(mockInput)
          ? [
              'COMFY_DYNAMICCOMBO_V3',
              { options: getSpec(mockInput, depth + 1) }
            ]
          : [mockInput, { tooltip: `${groupIndex}` }]
      ])
      return {
        key: `${groupIndex}`,
        inputs: { required: Object.fromEntries(inputSpec) }
      }
    })
  }
  const inputSpec: Required<InputSpec> = [
    'COMFY_DYNAMICCOMBO_V3',
    { options: getSpec(rootMockInputs) }
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
