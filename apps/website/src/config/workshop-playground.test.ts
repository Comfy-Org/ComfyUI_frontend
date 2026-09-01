import { describe, expect, it } from 'vitest'

import {
  MAX_UPLOAD_BYTES,
  defaultValues,
  schemaFor,
  validateForm
} from './workshop-playground'
import { buildSnippet } from './workshop-snippets'

describe('playground form', () => {
  const schema = schemaFor('video')

  it('seeds selects and numbers, leaves text and files empty', () => {
    const values = defaultValues(schema)
    expect(values.aspectRatio).toBe('16:9')
    expect(values.duration).toBe(5)
    expect(values.prompt).toBeUndefined()
    expect(values.image).toBeUndefined()
  })

  it('requires a prompt', () => {
    expect(validateForm(schema, defaultValues(schema))).toEqual({
      prompt: 'required'
    })
    expect(
      validateForm(schema, { ...defaultValues(schema), prompt: '  ' })
    ).toEqual({ prompt: 'required' })
  })

  it('rejects uploads over 25 MB or of the wrong type', () => {
    const valid = { ...defaultValues(schema), prompt: 'ok' }
    expect(
      validateForm(schema, {
        ...valid,
        image: {
          name: 'big.png',
          size: MAX_UPLOAD_BYTES + 1,
          type: 'image/png'
        }
      })
    ).toEqual({ image: 'tooLarge' })
    expect(
      validateForm(schema, {
        ...valid,
        image: { name: 'clip.mp4', size: 10, type: 'video/mp4' }
      })
    ).toEqual({ image: 'badType' })
    expect(
      validateForm(schema, {
        ...valid,
        image: { name: 'ok.webp', size: 10, type: 'image/webp' }
      })
    ).toEqual({})
  })
})

describe('buildSnippet', () => {
  const values = {
    prompt: 'a cat',
    seed: 7,
    image: { name: 'ref.png', size: 1, type: 'image/png' },
    unused: undefined
  }

  it('inlines form values and references uploads by file name', () => {
    const python = buildSnippet('python', 'kling/kling-ai', values)
    expect(python).toContain('"kling/kling-ai"')
    expect(python).toContain('"prompt": "a cat"')
    expect(python).toContain('"image": "<ref.png>"')
    expect(python).not.toContain('unused')
  })

  it('renders the same input for every language', () => {
    for (const language of ['typescript', 'http'] as const) {
      expect(buildSnippet(language, 'kling/kling-ai', values)).toContain(
        '"seed": 7'
      )
    }
  })
})
