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

  it('leaves a description that is nothing but the name', () => {
    expect(
      modelSummary('(Flux 2 Pro)', 'FLUX 2 Pro', 'Black Forest Labs')
    ).toBe('(Flux 2 Pro)')
  })
})
