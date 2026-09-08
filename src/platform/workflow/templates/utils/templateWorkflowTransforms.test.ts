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

  it('rejects drift between declared input metadata and workflow widgets', () => {
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
      ok: false,
      error: 'Expected one matching template widget value'
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
    ).toEqual({ ok: false, error: 'Image output has no filename' })
    expect(workflow.nodes[0].widgets_values).toEqual(['starter.png', 'image'])
  })

  it.for(['nodeId', 'nodeType', 'file'] as const)(
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
        error: 'Template image input declaration is invalid'
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
    ).toEqual({ ok: false, error: 'Template has no declared image input' })
  })

  it.for([
    { nodes: [], error: 'Expected one matching template node' },
    {
      nodes: [{ id: 2, type: 'LoadImage' }],
      error: 'Template input node has no configurable widgets'
    },
    {
      nodes: [
        {
          id: 2,
          type: 'LoadImage',
          widgets_values: ['starter.png', 'starter.png']
        }
      ],
      error: 'Expected one matching template widget value'
    }
  ])(
    'rejects invalid workflow input without mutation: $error',
    ({ nodes, error }) => {
      const workflow = { nodes }
      const before = structuredClone(workflow)
      expect(
        replaceTemplateImageInput(workflow, template, {
          filename: 'output.png'
        })
      ).toEqual({ ok: false, error })
      expect(workflow).toEqual(before)
    }
  )

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
            widgets_values: { image: 'output.png [output]', upload: 'image' }
          }
        ]
      }
    })
    expect(workflow.nodes[0].widgets_values.image).toBe('starter.png')
  })
})
