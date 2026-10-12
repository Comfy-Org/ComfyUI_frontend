import { describe, expect, it } from 'vitest'

import { modelSummary } from './model-summary'

describe('modelSummary', () => {
  it('drops a trailing name the reader already has above it', () => {
    expect(
      modelSummary(
        'Generates an image from text with up to 9 reference images (Flux 2 Pro).',
        'FLUX 2 Pro',
        'Black Forest Labs'
      )
    ).toBe('Generates an image from text with up to 9 reference images.')
  })

  it('counts the provider as part of the name the reader has', () => {
    expect(
      modelSummary(
        'Swaps a background while preserving the subject (Beeble SwitchX).',
        'SwitchX Image Edit',
        'Beeble'
      )
    ).toBe('Swaps a background while preserving the subject.')
  })

  it.for([
    ['Generates an image from text (predates Ultra).', 'FLUX Pro 1.1'],
    [
      'Edits an image from a prompt (Ideogram V3 inpainting).',
      'Ideogram V3 Edit'
    ]
  ] as const)(
    'keeps an aside that says something new: %s',
    ([summary, name]) => {
      expect(modelSummary(summary, name, 'Black Forest Labs')).toBe(summary)
    }
  )

  it('drops a closing attribution to the model named above it', () => {
    expect(
      modelSummary(
        'Edits one to three images with Qwen Image 3.0.',
        'Qwen Image 3.0',
        'Alibaba'
      )
    ).toBe('Edits one to three images.')
  })

  it.for([
    'Generates an image from text with up to 9 reference images.',
    'Generates a video from a prompt with optional driving audio.'
  ] as const)(
    'keeps a closing clause that qualifies the run: %s',
    (summary) => {
      expect(modelSummary(summary, 'Qwen Image 3.0', 'Alibaba')).toBe(summary)
    }
  )

  it('leaves a name the sentence is built around rather than trailing', () => {
    const summary =
      'Generates an adaptive-ratio Seedance 2.5 MP4 from first and optional last frames.'
    expect(modelSummary(summary, 'Seedance 2.5', 'ByteDance')).toBe(summary)
  })

  it('leaves a description that is nothing but the name', () => {
    expect(
      modelSummary('(Flux 2 Pro)', 'FLUX 2 Pro', 'Black Forest Labs')
    ).toBe('(Flux 2 Pro)')
  })
})
