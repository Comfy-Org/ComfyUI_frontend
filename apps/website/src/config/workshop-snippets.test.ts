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
    expect(python).toContain('"kling/kling-ai"')
    expect(python).toContain('"prompt": "a cat"')
    expect(python).toContain('"audio": true')
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
