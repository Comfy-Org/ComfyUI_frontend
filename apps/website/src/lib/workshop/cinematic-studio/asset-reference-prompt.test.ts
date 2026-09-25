import { describe, expect, it } from 'vitest'
import { assetReferencePrompt } from './asset-reference-prompt'

describe('asset reference directions', () => {
  it('keeps role instructions aligned after cast and palette images', () => {
    expect(
      assetReferencePrompt(
        [
          {
            name: 'Harbor',
            kind: 'location',
            notes: 'Keep the red lighthouse.'
          },
          { name: 'Compass', kind: 'prop', notes: '' }
        ],
        2
      )
    ).toBe(
      'Use reference image 3 for the location "Harbor". Preserve these details: Keep the red lighthouse. Use reference image 4 for the prop "Compass".'
    )
    expect(assetReferencePrompt([], 0)).toBe('')
  })
})
