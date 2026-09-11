import { describe, expect, it } from 'vitest'

import type { WorkshopModelDetail } from './models-catalogue'
import { initialWorkshopPageState } from './workshop-page-state'

const model: WorkshopModelDetail = {
  slug: 'example--model--generate-images',
  name: 'Example model',
  workflowCount: 1,
  href: '/models/example--model--generate-images/',
  routerId: 'example/model',
  capabilities: [],
  modality: 'image',
  fields: [
    {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      multiline: true,
      required: true
    }
  ],
  defaults: { prompt: 'Page default' },
  examples: [
    {
      name: 'first',
      title: 'First',
      description: '',
      tags: [],
      thumbnailUrl: 'https://example.com/result.webp',
      values: { prompt: 'First example' }
    }
  ]
}

describe('initialWorkshopPageState', () => {
  it('uses the first runnable example just like the model page', () => {
    const state = initialWorkshopPageState(model)

    expect(state.firstExample?.id).toBe('first')
    expect(state.values).toEqual({ prompt: 'First example' })
  })

  it('keeps page defaults when the first example is output-only', () => {
    const state = initialWorkshopPageState({
      ...model,
      examples: [{ ...model.examples[0], sampleOnly: true }]
    })

    expect(state.values).toEqual({ prompt: 'Page default' })
  })
})
