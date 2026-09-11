import { describe, expect, it } from 'vitest'

import type { WorkshopModelDetail } from './models-catalogue'
import {
  initialWorkshopPageState,
  workshopExampleState
} from './workshop-page-state'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { validateForm } from './workshop-playground'

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
  it.for([
    'freepik--magnific-upscaler-precise-v2--edit-images',
    'gemini--omni-1.1-flash--animate-images',
    'gemini--omni-flash-preview--animate-images',
    'wan--reference-to-video-3.0-prime--animate-images',
    'wavespeed--flashvsr--edit-videos'
  ])(
    'keeps initial defaults when reselecting the first example: %s',
    (slug) => {
      const model = getRouterWorkshopModelDetail(slug)
      if (!model) throw new Error(`Missing model ${slug}`)
      const initial = initialWorkshopPageState(model)
      if (!initial.firstExample || initial.firstExample.sampleOnly)
        throw new Error('Expected a runnable example')
      const selected = workshopExampleState(model, initial.firstExample)
      expect(selected.schema).toEqual(initial.schema)
      expect(selected.values).toEqual(initial.values)
      expect(validateForm(selected.schema, selected.values)).toEqual({})
    }
  )
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
