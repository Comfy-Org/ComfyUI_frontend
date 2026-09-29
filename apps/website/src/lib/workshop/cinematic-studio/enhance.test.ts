import { describe, expect, it } from 'vitest'

import {
  ENHANCE_MODEL,
  enhanceContract,
  enhancedScene,
  enhanceRequest
} from './enhance'

describe('enhance', () => {
  it('runs on the pinned GPT 5.6 Luna contract', () => {
    expect(enhanceContract()?.id).toBe(ENHANCE_MODEL)
  })

  it('asks for a frozen moment for a still and for motion for a clip', () => {
    const still = enhanceRequest('  A diner at dawn ', false)
    const clip = enhanceRequest('A diner at dawn', true)

    expect(still.input).toBe('A diner at dawn')
    expect(still.instructions).toContain('single frozen moment')
    expect(clip.instructions).toContain('what happens over time')
    expect(still.instructions).not.toBe(clip.instructions)
    for (const body of [still, clip])
      expect(body.instructions).toContain('Do not mention reference images')
  })

  it('reads the message text and skips reasoning items', () => {
    const document = JSON.stringify({
      output: [
        { type: 'reasoning', summary: [{ type: 'summary_text', text: 'x' }] },
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'A waitress wipes the counter.\n' },
            { type: 'output_text', text: ' Steam rises.' }
          ]
        }
      ]
    })

    expect(enhancedScene(document)).toBe(
      'A waitress wipes the counter. Steam rises.'
    )
  })

  it('reads a top-level output_text', () => {
    expect(enhancedScene(JSON.stringify({ output_text: 'Rain.' }))).toBe(
      'Rain.'
    )
  })

  it.for(['not json', '[]', JSON.stringify({ output: [] })])(
    'returns nothing for %s',
    (document) => {
      expect(enhancedScene(document)).toBeUndefined()
    }
  )
})
