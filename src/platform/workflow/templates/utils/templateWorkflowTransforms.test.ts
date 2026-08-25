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

    expect(continued.nodes[0].widgets_values).toEqual([
      'tour/first-output.png [output]',
      'image'
    ])
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

    expect(() =>
      replaceTemplateImageInput(workflow, template, {
        filename: 'first-output.png'
      })
    ).toThrow('Expected one matching template widget value')
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

    expect(() =>
      replaceTemplateImageInput(workflow, template, { type: 'output' })
    ).toThrow('Image output has no filename')
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
      expect(() =>
        replaceTemplateImageInput(workflow, incompleteTemplate, {
          filename: 'first-output.png'
        })
      ).toThrow('Template image input declaration is invalid')
      expect(workflow.nodes[0].widgets_values).toEqual(['starter.png', 'image'])
    }
  )

  it('reports a template with no declared image input as unusable', () => {
    expect(acceptsTemplateImageInput(template)).toBe(true)
    expect(acceptsTemplateImageInput({ ...template, io: undefined })).toBe(
      false
    )
  })
})
