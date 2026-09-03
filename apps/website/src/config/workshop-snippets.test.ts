import { describe, expect, it } from 'vitest'

import { buildSnippet } from './workshop-snippets'

describe('buildSnippet', () => {
  const values = {
    prompt: 'a cat',
    seed: 7,
    audio: true,
    image: { name: 'ref.png', size: 1, type: 'image/png' },
    unused: undefined
  }

  it('inlines form values and references uploads by file name', () => {
    const python = buildSnippet('python', 'kling/kling-ai', values)
    expect(python).toContain('https://api.comfy.org/v2/models/kling/kling-ai')
    expect(python).toContain('"prompt": "a cat"')
    expect(python).toContain('"audio": true')
    expect(python).toContain('"image": "<ref.png>"')
    expect(python).not.toContain('unused')
  })

  it('posts the release name in the body and the full id in the path', () => {
    const curl = buildSnippet('curl', 'openai/gpt-image', { seed: 7 })
    expect(curl).toContain(
      'POST https://api.comfy.org/v2/models/openai/gpt-image'
    )
    expect(curl).toContain('"model": "gpt-image"')
  })

  it('keeps the release a model names for itself', () => {
    const python = buildSnippet('python', 'xai/grok-imagine', {
      model: 'grok-imagine-video-1.5'
    })
    expect(python).toContain('"model": "grok-imagine-video-1.5"')
  })

  it('renders the same input for every language', () => {
    for (const language of ['typescript', 'curl'] as const) {
      expect(buildSnippet(language, 'kling/kling-ai', values)).toContain(
        '"seed": 7'
      )
    }
  })
})
