import { describe, expect, it } from 'vitest'

import { workshopContract } from '../../../config/workshop-contract-catalog'
import { ENHANCE_MODEL, enhancedScene, enhanceRequest } from './enhance'

const completed = (body: Record<string, unknown>) =>
  JSON.stringify({ status: 'completed', ...body })

describe('enhance', () => {
  it('names a model the pinned contracts have', () => {
    expect(workshopContract(ENHANCE_MODEL)?.id).toBe(ENHANCE_MODEL)
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
    const document = completed({
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
    expect(enhancedScene(completed({ output_text: 'Rain.' }))).toBe('Rain.')
  })

  it('refuses a reply that did not complete', () => {
    const cutOff = JSON.stringify({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output_text: 'A waitress wipes the'
    })
    expect(enhancedScene(cutOff)).toBeUndefined()
  })

  it.for(['not json', '[]', completed({ output: [] })])(
    'returns nothing for %s',
    (document) => {
      expect(enhancedScene(document)).toBeUndefined()
    }
  )
})
