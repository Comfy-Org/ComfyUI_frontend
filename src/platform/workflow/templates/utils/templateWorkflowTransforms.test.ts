import { describe, expect, it } from 'vitest'

import type { TemplateInfo } from '../types/template'
import {
  replaceTemplateImageInput,
  replaceUniqueTemplateWidgetValue
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

  it('configures a unique template widget without relying on its node id', () => {
    const workflow = {
      nodes: [
        {
          id: 37,
          type: 'ImageScaleBy',
          widgets_values: ['lanczos', 2]
        }
      ]
    }

    const configured = replaceUniqueTemplateWidgetValue(
      workflow,
      'ImageScaleBy',
      2,
      4
    )

    expect(configured.nodes[0].widgets_values).toEqual(['lanczos', 4])
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
})
