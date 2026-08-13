import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { revealDynamicInputSlot } from '@/core/graph/widgets/revealDynamicInputSlot'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'

setActivePinia(createTestingPinia())

const comboSpec: InputSpec = [
  'COMFY_DYNAMICCOMBO_V3',
  {
    options: [
      {
        key: 'text_to_image',
        inputs: { required: { prompt: ['STRING', {}] } }
      },
      {
        key: 'image_edit',
        inputs: { required: { image: ['IMAGE', {}] } }
      }
    ]
  }
]

function nodeWithCombo() {
  class TestNode extends LGraphNode {}
  const specV2 = transformInputSpecV1ToV2(comboSpec, {
    name: 'model',
    isOptional: false
  })
  Object.assign(TestNode, { nodeData: { inputs: { model: specV2 } } })

  const node = new TestNode('test')
  node.widgets = []
  useLitegraphService().addNodeInput(node, specV2)
  return node as LGraphNode & Required<Pick<LGraphNode, 'widgets'>>
}

describe('revealDynamicInputSlot', () => {
  it('selects the option exposing the dropped type when no socket has it', () => {
    const node = nodeWithCombo()
    expect(node.findInputByType('IMAGE')).toBeUndefined()

    expect(revealDynamicInputSlot(node, 'IMAGE')).toBe(true)

    expect(node.findInputByType('IMAGE')).toBeDefined()
    expect(node.widgets[0].value).toBe('image_edit')
  })

  it('does nothing when the node already exposes the type', () => {
    const node = nodeWithCombo()
    node.widgets[0].value = 'image_edit'

    expect(revealDynamicInputSlot(node, 'IMAGE')).toBe(false)
    expect(node.widgets[0].value).toBe('image_edit')
  })

  it('does nothing when no option exposes the type', () => {
    const node = nodeWithCombo()

    expect(revealDynamicInputSlot(node, 'LATENT')).toBe(false)
    expect(node.widgets[0].value).toBe('text_to_image')
  })
})
