import { describe, expect, it } from 'vitest'

import type { ApiSpecSource } from './apiSpec'
import { buildApiSpec, deriveWorkflowId, exampleRequestBody } from './apiSpec'

function specFrom(partial: Partial<ApiSpecSource>) {
  return buildApiSpec({
    title: 'My Workflow',
    workflowId: 'wf_test1',
    parameters: [],
    outputs: [],
    ...partial
  })
}

describe('deriveWorkflowId', () => {
  it('is deterministic and prefixed for a given seed', () => {
    const id = deriveWorkflowId('workflows/api-test.json')
    expect(id).toBe(deriveWorkflowId('workflows/api-test.json'))
    expect(id).toMatch(/^wf_[a-z0-9]+$/)
  })

  it('differs for different seeds', () => {
    expect(deriveWorkflowId('workflows/a.json')).not.toBe(
      deriveWorkflowId('workflows/b.json')
    )
  })
})

describe('buildApiSpec', () => {
  it('builds the submit URL from the workflow id, not the title', () => {
    const spec = specFrom({ title: 'My Cool Workflow (v2)!' })
    expect(spec.submitUrl).toContain('/workflows/wf_test1/run')
    expect(spec.submitUrl).not.toContain('cool')
  })

  it('maps widget types to parameter types', () => {
    const spec = specFrom({
      parameters: [
        {
          displayName: 'Steps',
          widgetType: 'number',
          value: 20,
          options: { precision: 0, min: 1, max: 100 }
        },
        {
          displayName: 'CFG',
          widgetType: 'slider',
          value: 7.5,
          options: { min: 0, max: 20 }
        },
        {
          displayName: 'Sampler',
          widgetType: 'combo',
          value: 'euler',
          options: { values: ['euler', 'ddim'] }
        },
        { displayName: 'Tiled', widgetType: 'toggle', value: true },
        { displayName: 'Prompt', widgetType: 'customtext', value: 'a cat' }
      ]
    })

    expect(spec.parameters.map((p) => p.type)).toEqual([
      'integer',
      'number',
      'string',
      'boolean',
      'string'
    ])
    expect(spec.parameters[0]).toMatchObject({
      name: 'steps',
      minimum: 1,
      maximum: 100,
      defaultValue: 20,
      required: false
    })
    expect(spec.parameters[2].enumValues).toEqual(['euler', 'ddim'])
  })

  it('types media upload widgets as required media parameters, ignoring the file-list enum', () => {
    const spec = specFrom({
      parameters: [
        {
          displayName: 'image',
          nodeTitle: 'Load Image',
          widgetType: 'combo',
          value: 'photo.png',
          mediaKind: 'image',
          options: { values: ['photo.png', 'other.png'] }
        }
      ]
    })

    expect(spec.parameters[0]).toMatchObject({
      name: 'image',
      type: 'image',
      required: true
    })
    expect(spec.parameters[0].enumValues).toBeUndefined()
    expect(spec.parameters[0].defaultValue).toBeUndefined()
  })

  it('types 3D model upload widgets as mesh parameters', () => {
    const spec = specFrom({
      parameters: [
        {
          displayName: 'model_file',
          nodeTitle: 'Load 3D',
          widgetType: 'combo',
          value: 'chair.glb',
          mediaKind: 'mesh',
          options: { values: ['chair.glb', 'table.obj'] }
        }
      ]
    })

    expect(spec.parameters[0]).toMatchObject({
      name: 'model_file',
      type: 'mesh',
      required: true
    })
    expect(spec.parameters[0].enumValues).toBeUndefined()
  })

  it('marks parameters without a primitive value as required', () => {
    const spec = specFrom({
      parameters: [
        { displayName: 'Image', widgetType: 'image', value: undefined }
      ]
    })
    expect(spec.parameters[0].required).toBe(true)
    expect(spec.parameters[0].defaultValue).toBeUndefined()
  })

  it('keys outputs by a readable slug of their title, deduping collisions', () => {
    const spec = specFrom({
      outputs: [
        { nodeId: '9', title: 'Save Image' },
        { nodeId: '12', title: 'Save Image' },
        { nodeId: '15', title: 'Preview (Final)' }
      ]
    })

    expect(spec.outputs.map((o) => o.key)).toEqual([
      'save_image',
      'save_image_2',
      'preview_final'
    ])
  })

  it('dedupes colliding parameter names', () => {
    const spec = specFrom({
      parameters: [
        { displayName: 'Prompt', widgetType: 'customtext', value: 'a' },
        { displayName: 'prompt', widgetType: 'customtext', value: 'b' },
        { displayName: 'Prompt!', widgetType: 'customtext', value: 'c' }
      ]
    })
    expect(spec.parameters.map((p) => p.name)).toEqual([
      'prompt',
      'prompt_2',
      'prompt_3'
    ])
  })
})

describe('exampleRequestBody', () => {
  it('uses defaults and typed placeholders for missing values', () => {
    const spec = specFrom({
      parameters: [
        { displayName: 'Prompt', widgetType: 'customtext', value: 'a cat' },
        {
          displayName: 'Seed',
          widgetType: 'number',
          value: undefined,
          options: { precision: 0, min: 1 }
        },
        {
          displayName: 'Sampler',
          widgetType: 'combo',
          value: undefined,
          options: { values: ['euler', 'ddim'] }
        }
      ]
    })

    expect(exampleRequestBody(spec)).toEqual({
      prompt: 'a cat',
      seed: 1,
      sampler: 'euler'
    })
  })

  it('includes only required parameters when requiredOnly is set', () => {
    const spec = specFrom({
      parameters: [
        { displayName: 'Prompt', widgetType: 'customtext', value: 'a cat' },
        {
          displayName: 'Image',
          widgetType: 'combo',
          value: 'photo.png',
          mediaKind: 'image',
          options: { values: ['photo.png'] }
        }
      ]
    })

    expect(exampleRequestBody(spec, true)).toEqual({
      image: 'https://example.com/input.png'
    })
  })

  it('uses a URL placeholder for media parameters instead of a gallery filename', () => {
    const spec = specFrom({
      parameters: [
        {
          displayName: 'image',
          widgetType: 'combo',
          value: 'photo.png',
          mediaKind: 'image',
          options: { values: ['photo.png'] }
        }
      ]
    })

    expect(exampleRequestBody(spec)).toEqual({
      image: 'https://example.com/input.png'
    })
  })
})
