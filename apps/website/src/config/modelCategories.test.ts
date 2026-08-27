import { describe, expect, it } from 'vitest'

import { deriveModelCategories } from './modelCategories'

describe('deriveModelCategories', () => {
  it('uses the workflow section and explicit capability tags', () => {
    expect(
      deriveModelCategories('Video', [
        'Image to Video',
        'Video Edit',
        'Video Upscale'
      ])
    ).toEqual(['image', 'video', 'edit', 'upscale'])
  })

  it('does not treat LoRA usage as model training', () => {
    expect(deriveModelCategories('Image', ['LoRA'])).toEqual(['image'])
  })

  it('preserves categories supported only by explicit tags', () => {
    expect(
      deriveModelCategories('Use Cases', [
        'Text to Audio',
        'Image to 3D',
        'Text Generation'
      ])
    ).toEqual(['image', 'audio', '3d', 'llm'])
  })

  it('does not classify video with native audio as audio generation', () => {
    expect(deriveModelCategories('Video', ['Video with Native Audio'])).toEqual(
      ['video']
    )
  })
})
