import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { revealDynamicInputSlot } from '@/core/graph/widgets/revealDynamicInputSlot'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'

setActivePinia(createTestingPinia())

const defaultOptions = [
  { key: 'text_to_image', inputs: { required: { prompt: ['STRING', {}] } } },
  { key: 'image_edit', inputs: { required: { image: ['IMAGE', {}] } } }
]

function nodeWithCombo(
  options: { key: string; inputs: unknown }[] = defaultOptions
) {
  class TestNode extends LGraphNode {}
  const specV2 = transformInputSpecV1ToV2(
    ['COMFY_DYNAMICCOMBO_V3', { options }] as InputSpec,
    { name: 'model', isOptional: false }
  )
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

  it('selects through a nested combo so the socket actually appears', () => {
    const node = nodeWithCombo([
      { key: 'plain', inputs: { required: { prompt: ['STRING', {}] } } },
      {
        key: 'advanced',
        inputs: {
          required: {
            sub: [
              'COMFY_DYNAMICCOMBO_V3',
              {
                options: [
                  { key: 'a', inputs: { required: { n: ['INT', {}] } } },
                  { key: 'b', inputs: { required: { m: ['MASK', {}] } } }
                ]
              }
            ]
          }
        }
      }
    ])

    expect(revealDynamicInputSlot(node, 'MASK')).toBe(true)
    expect(node.findInputByType('MASK')).toBeDefined()
  })

  it('leaves every widget value untouched when the reveal fails', () => {
    const node = nodeWithCombo()
    const before = node.widgets.map((w) => w.value)

    expect(revealDynamicInputSlot(node, 'CONDITIONING')).toBe(false)

    expect(node.widgets.map((w) => w.value)).toEqual(before)
    expect(node.findInputByType('CONDITIONING')).toBeUndefined()
  })

  it('selects an option whose type is nested inside an Autogrow', () => {
    const node = nodeWithCombo([
      { key: 'plain', inputs: { required: { prompt: ['STRING', {}] } } },
      {
        key: 'batch',
        inputs: {
          required: {
            images: [
              'COMFY_AUTOGROW_V3',
              { template: { input: { required: { image: ['IMAGE', {}] } } } }
            ]
          }
        }
      }
    ])

    expect(revealDynamicInputSlot(node, 'IMAGE')).toBe(true)
    expect(node.widgets[0].value).toBe('batch')
  })

  it('does nothing for a malformed spec', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = nodeWithCombo()
    Object.assign(node.constructor, {
      nodeData: {
        inputs: {
          model: transformInputSpecV1ToV2(
            ['COMFY_DYNAMICCOMBO_V3', { options: [{ key: 'bad' }] }],
            { name: 'model', isOptional: false }
          )
        }
      }
    })

    expect(revealDynamicInputSlot(node, 'IMAGE')).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unparseable COMFY_DYNAMICCOMBO_V3 spec'),
      expect.anything()
    )
    warn.mockRestore()
  })
})
