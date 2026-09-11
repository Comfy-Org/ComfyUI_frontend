import { describe, expect, it } from 'vitest'

import type { TemplateInfo } from '../types/template'
import {
  acceptsTemplateImageInput,
  replaceTemplateImageInput
} from './templateWorkflowTransforms'

const template: TemplateInfo = {
  name: 'image-template',
  description: 'Image template',
  mediaType: 'image',
  mediaSubtype: 'png',
  io: {
    inputs: [
      {
        nodeId: 2,
        nodeType: 'LoadImage',
        file: 'starter.png',
        mediaType: 'image'
      }
    ]
  }
}

describe('template workflow transforms', () => {
  it('seeds a declared image input with an output asset', () => {
    const workflow = {
      nodes: [
        {
          id: 2,
          type: 'LoadImage',
          widgets_values: ['starter.png', 'image']
        }
      ]
    }

    const continued = replaceTemplateImageInput(workflow, template, {
      filename: 'first-output.png',
      subfolder: 'tour',
      type: 'output'
    })

    expect(continued).toEqual({
      ok: true,
      value: {
        nodes: [
          {
            id: 2,
            type: 'LoadImage',
            widgets_values: ['tour/first-output.png [output]', 'image']
          }
        ]
      }
    })
    expect(workflow.nodes[0].widgets_values).toEqual(['starter.png', 'image'])
  })

  it('binds the image widget even when the placeholder changes', () => {
    const workflow = {
      nodes: [
        {
          id: 2,
          type: 'LoadImage',
          widgets_values: ['different.png', 'image']
        }
      ]
    }

    expect(
      replaceTemplateImageInput(workflow, template, {
        filename: 'first-output.png'
      })
    ).toEqual({
      ok: true,
      value: {
        nodes: [
          {
            id: 2,
            type: 'LoadImage',
            widgets_values: ['first-output.png [output]', 'image']
          }
        ]
      }
    })
    expect(workflow.nodes[0].widgets_values).toEqual(['different.png', 'image'])
  })

  it('rejects an output with no filename', () => {
    const workflow = {
      nodes: [
        {
          id: 2,
          type: 'LoadImage',
          widgets_values: ['starter.png', 'image']
        }
      ]
    }

    expect(
      replaceTemplateImageInput(workflow, template, { type: 'output' })
    ).toEqual({
      ok: false,
      error: 'Image output has no filename',
      failureCategory: 'semantic_binding',
      reason: 'missing_output_filename'
    })
    expect(workflow.nodes[0].widgets_values).toEqual(['starter.png', 'image'])
  })

  it.for(['nodeId', 'nodeType'] as const)(
    'rejects an image input without %s',
    (field) => {
      const incompleteTemplate = structuredClone(template)
      const input = incompleteTemplate.io?.inputs?.[0]
      if (!input) throw new Error('Expected template image input')
      input[field] = undefined
      const workflow = {
        nodes: [
          {
            id: 2,
            type: 'LoadImage',
            widgets_values: ['starter.png', 'image']
          }
        ]
      }

      expect(acceptsTemplateImageInput(incompleteTemplate)).toBe(false)
      expect(
        replaceTemplateImageInput(workflow, incompleteTemplate, {
          filename: 'first-output.png'
        })
      ).toEqual({
        ok: false,
        error: 'Template image input declaration is invalid',
        failureCategory: 'template_metadata',
        reason: 'invalid_image_input'
      })
      expect(workflow.nodes[0].widgets_values).toEqual(['starter.png', 'image'])
    }
  )

  it('reports a template with no declared image input as unusable', () => {
    expect(acceptsTemplateImageInput(template)).toBe(true)
    expect(acceptsTemplateImageInput({ ...template, io: undefined })).toBe(
      false
    )
    expect(
      replaceTemplateImageInput(
        { nodes: [] },
        { ...template, io: undefined },
        {
          filename: 'output.png'
        }
      )
    ).toEqual({
      ok: false,
      error: 'Template has no declared image input',
      failureCategory: 'template_metadata',
      reason: 'missing_image_input'
    })
  })

  it.for([
    {
      nodes: [],
      error: 'Expected one matching template node',
      reason: 'input_node_missing'
    },
    {
      nodes: [
        { id: 2, type: 'LoadImage', widgets_values: ['starter.png'] },
        { id: 2, type: 'LoadImage', widgets_values: ['starter.png'] }
      ],
      error: 'Expected one matching template node',
      reason: 'input_node_ambiguous'
    },
    {
      nodes: [{ id: 2, type: 'LoadImage' }],
      error: 'Template input node has no configurable widgets',
      reason: 'missing_widget_values'
    },
    {
      nodes: [
        {
          id: 2,
          type: 'LoadImage',
          widgets_values: { upload: 'starter.png' }
        }
      ],
      error: 'LoadImage has no serialized image widget',
      reason: 'widget_value_missing'
    }
  ])(
    'rejects invalid workflow input without mutation: $error',
    ({ nodes, error, reason }) => {
      const workflow = { nodes }
      const before = structuredClone(workflow)
      expect(
        replaceTemplateImageInput(workflow, template, {
          filename: 'output.png'
        })
      ).toEqual({
        ok: false,
        error,
        failureCategory: 'semantic_binding',
        reason
      })
      expect(workflow).toEqual(before)
    }
  )

  it.for([undefined, 'changed.png'])(
    'does not require a placeholder file: %s',
    (file) => {
      const declared = structuredClone(template)
      declared.io!.inputs![0].file = file
      expect(acceptsTemplateImageInput(declared)).toBe(true)
      const result = replaceTemplateImageInput(
        {
          nodes: [
            {
              id: 2,
              type: 'LoadImage',
              widgets_values: ['same.png', 'same.png']
            }
          ]
        },
        declared,
        { filename: 'output.png' }
      )
      expect(result).toMatchObject({
        ok: true,
        value: {
          nodes: [{ widgets_values: ['output.png [output]', 'same.png'] }]
        }
      })
    }
  )

  it.for([
    [{ mediaType: 'image', nodeId: 2, nodeType: 'OtherImageLoader' }],
    [
      { mediaType: 'image', nodeId: 2, nodeType: 'LoadImage' },
      { mediaType: 'image', nodeId: 3, nodeType: 'LoadImage' }
    ],
    [{ mediaType: 'image', nodeId: '', nodeType: 'LoadImage' }],
    [{ mediaType: 'image', nodeId: Number.NaN, nodeType: 'LoadImage' }]
  ])('rejects unsupported or ambiguous declarations: %j', (inputs) => {
    const declared = { ...template, io: { inputs } }
    expect(acceptsTemplateImageInput(declared)).toBe(false)
    expect(
      replaceTemplateImageInput({ nodes: [] }, declared, {
        filename: 'output.png'
      })
    ).toMatchObject({ ok: false, reason: 'invalid_image_input' })
  })

  it('rejects duplicate node ids even when their types differ', () => {
    expect(
      replaceTemplateImageInput(
        {
          nodes: [
            { id: 2, type: 'LoadImage' },
            { id: '2', type: 'Other' }
          ]
        },
        template,
        { filename: 'output.png' }
      )
    ).toMatchObject({ ok: false, reason: 'input_node_ambiguous' })
  })

  it('updates both native widget serializations without changing other values', () => {
    const workflow = {
      nodes: [
        {
          id: 2,
          type: 'LoadImage',
          widgets_values: ['array.png', 'upload'],
          widgets_values_named: { image: 'named.png', upload: 'upload' }
        }
      ]
    }
    expect(
      replaceTemplateImageInput(workflow, template, { filename: 'output.png' })
    ).toEqual({
      ok: true,
      value: {
        nodes: [
          {
            id: 2,
            type: 'LoadImage',
            widgets_values: ['output.png [output]', 'upload'],
            widgets_values_named: {
              image: 'output.png [output]',
              upload: 'upload'
            }
          }
        ]
      }
    })
    expect(workflow.nodes[0].widgets_values_named.image).toBe('named.png')
  })

  it('rejects an incompatible native named serialization', () => {
    expect(
      replaceTemplateImageInput(
        {
          nodes: [
            {
              id: 2,
              type: 'LoadImage',
              widgets_values: ['starter.png'],
              widgets_values_named: { renamed_image: 'starter.png' }
            }
          ]
        },
        template,
        { filename: 'output.png' }
      )
    ).toMatchObject({ ok: false, reason: 'widget_value_missing' })
  })

  it('refuses to seed a linked input whose widget value would be ignored', () => {
    expect(
      replaceTemplateImageInput(
        {
          nodes: [
            {
              id: 2,
              type: 'LoadImage',
              widgets_values: ['starter.png'],
              inputs: [{ name: 'image', link: 5 }]
            }
          ]
        },
        template,
        { filename: 'output.png' }
      )
    ).toMatchObject({ ok: false, reason: 'input_widget_linked' })
  })

  it('rejects unknown legacy named widgets rather than losing their values', () => {
    expect(
      replaceTemplateImageInput(
        {
          nodes: [
            {
              id: 2,
              type: 'LoadImage',
              widgets_values: {
                image: 'starter.png',
                unknownWidget: 'preserve me'
              }
            }
          ]
        },
        template,
        { filename: 'output.png' }
      )
    ).toMatchObject({ ok: false, reason: 'widget_value_missing' })
  })

  it('preserves named widget values when seeding an image', () => {
    const workflow = {
      nodes: [
        {
          id: 2,
          type: 'LoadImage',
          widgets_values: { image: 'starter.png', upload: 'image' }
        }
      ]
    }
    expect(
      replaceTemplateImageInput(workflow, template, { filename: 'output.png' })
    ).toEqual({
      ok: true,
      value: {
        nodes: [
          {
            id: 2,
            type: 'LoadImage',
            widgets_values: ['output.png [output]', 'image'],
            widgets_values_named: {
              image: 'output.png [output]',
              upload: 'image'
            }
          }
        ]
      }
    })
    expect(workflow.nodes[0].widgets_values.image).toBe('starter.png')
  })
})
