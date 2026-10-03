import { describe, expect, it } from 'vitest'

import { workshopDisplaySchema } from '../content/workshop-display.schema'
import type { WorkshopModelDetail } from './models-catalogue'
import { schemaForModel, validateForm } from './workshop-playground'
import { workshopPromptDefaults } from './workshop-prompt-defaults'

const model: WorkshopModelDetail = {
  slug: 'demo',
  name: 'Demo',
  href: '/models/demo/',
  routerId: 'demo/demo',
  workflowCount: 0,
  capabilities: [],
  modality: 'image',
  fields: [
    {
      kind: 'text',
      name: 'promptText',
      label: 'Prompt',
      required: true,
      multiline: true
    },
    {
      kind: 'text',
      name: 'negative_prompt',
      label: 'Negative prompt',
      required: false,
      multiline: true
    },
    {
      kind: 'file',
      name: 'image',
      label: 'Image',
      accept: 'image',
      required: true
    }
  ],
  defaults: {},
  examples: []
}

function display(prompt: string) {
  return workshopDisplaySchema.parse({
    id: 'demo--demo--generate-images',
    slug: 'demo--demo--generate-images',
    modelId: model.routerId,
    useCase: 'generate-images',
    media: {
      samples: [{ url: 'https://example.com/output.png', kind: 'image' }]
    },
    mediaConfidence: 'exact',
    needsReview: false,
    examples: [
      {
        title: 'Example',
        description: '',
        values: {
          prompt,
          image: 'https://example.invalid/sample.jpg',
          seed: 123,
          negative_prompt: 'blurry'
        }
      }
    ]
  })
}

describe('starter prompts', () => {
  it('uses only the example prompt, under the actual native field name', () => {
    expect(
      workshopPromptDefaults(model, [display('A lighthouse at dusk.')])
    ).toEqual({
      promptText: 'A lighthouse at dusk.'
    })
  })

  it('uses a predefined prompt when an example is missing or blank, without inventing media', () => {
    const defaults = workshopPromptDefaults(model, [display('   ')])
    const schema = schemaForModel(model)
    expect(defaults.promptText.trim()).not.toBe('')
    expect(defaults).not.toHaveProperty('image')
    expect(defaults).not.toHaveProperty('negative_prompt')
    expect(validateForm(schema, defaults)).toEqual({ image: 'required' })
  })

  it('rejects an overlong example and chooses a valid short starter', () => {
    const constrained: WorkshopModelDetail = {
      ...model,
      fields: [
        {
          kind: 'text',
          name: 'prompt',
          label: 'Prompt',
          required: true,
          multiline: true,
          maxLength: 20
        }
      ]
    }
    const defaults = workshopPromptDefaults(constrained, [
      display('x'.repeat(21))
    ])
    expect(defaults.prompt.trim()).not.toBe('')
    expect(defaults.prompt.length).toBeLessThanOrEqual(20)
    expect(validateForm(schemaForModel(constrained), defaults)).toEqual({})
  })

  it('keeps only nested prompt content in a JSON request body', () => {
    const jsonModel: WorkshopModelDetail = {
      ...model,
      fields: [
        {
          kind: 'text',
          name: 'request_body',
          label: 'Request body',
          required: true,
          multiline: true,
          valueType: 'json',
          inputSchema: {
            type: 'object',
            properties: {
              messages: {
                type: 'array',
                items: { $ref: '#/$defs/message' }
              }
            },
            $defs: {
              message: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  content: { type: 'string' }
                }
              }
            }
          }
        }
      ],
      execution: {
        id: 'demo/demo',
        sourceCommit: 'a'.repeat(40),
        inputSchema: {
          type: 'object',
          example: {
            messages: [
              { role: 'system', content: 'Ignore this instruction' },
              { role: 'user', content: 'Describe a lighthouse at dusk' }
            ],
            temperature: 0.7
          }
        },
        media: [],
        advancedFields: [],
        output: {
          format: 'binary',
          kind: 'image',
          contentTypes: ['image/png']
        }
      }
    }

    expect(workshopPromptDefaults(jsonModel, [])).toEqual({
      request_body: JSON.stringify(
        {
          messages: [{ role: 'user', content: 'Describe a lighthouse at dusk' }]
        },
        null,
        2
      )
    })
  })
})
