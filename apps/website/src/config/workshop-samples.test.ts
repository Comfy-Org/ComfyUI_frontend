import { describe, expect, it } from 'vitest'

import type { WorkshopField } from './workshop-detail'
import { withSamplePrompt } from './workshop-samples'

function text(name: string): WorkshopField {
  return {
    kind: 'text',
    name,
    label: name,
    required: false,
    multiline: true,
    valueType: 'string'
  }
}

describe('withSamplePrompt', () => {
  it('fills an empty prompt so the first action is pressing Run', () => {
    const fields = [text('prompt')]
    expect(withSamplePrompt({}, fields, 'image').prompt).toContain('bicycle')
  })

  it('writes text a text-to-speech model can actually read aloud', () => {
    // The same words do not work everywhere: an audio model speaks its
    // prompt, so "a red bicycle, soft morning light" would be nonsense.
    const spoken = withSamplePrompt({}, [text('prompt')], 'audio').prompt
    expect(spoken).toBe(
      'Comfy Workshop lets you run any model straight from your browser.'
    )
  })

  it('never overwrites a default the model itself specifies', () => {
    expect(
      withSamplePrompt(
        { prompt: 'the model knows best' },
        [text('prompt')],
        'image'
      )
    ).toEqual({ prompt: 'the model knows best' })
  })

  it('does not fill the negative prompt', () => {
    const fields = [text('prompt'), text('negative_prompt')]
    const seeded = withSamplePrompt({}, fields, 'image')

    expect(seeded.prompt).toBeDefined()
    expect(seeded.negative_prompt).toBeUndefined()
  })

  it('finds the prompt under its other spellings', () => {
    // ideogram calls it text_prompt; some models just call it text.
    expect(
      withSamplePrompt({}, [text('text_prompt')], 'image').text_prompt
    ).toBeDefined()
    expect(withSamplePrompt({}, [text('text')], 'image').text).toBeDefined()
  })

  it('leaves a model with no prompt field alone', () => {
    const upscaler = [
      {
        kind: 'media' as const,
        name: 'media_image',
        role: 'image',
        label: 'Image',
        required: true,
        multiple: false,
        accept: 'image' as const
      }
    ]
    expect(withSamplePrompt({}, upscaler, 'image')).toEqual({})
  })
})
