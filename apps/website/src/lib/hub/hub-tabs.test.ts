import { describe, expect, it } from 'vitest'

import { badgesAvailableIn } from './hub-tabs'

describe('badgesAvailableIn', () => {
  it('keeps only partners and tags available in the new tab', () => {
    const badges = [
      { type: 'partner', value: 'Kling' },
      { type: 'partner', value: 'OpenAI' },
      { type: 'tag', value: 'Video' }
    ]

    expect(
      badgesAvailableIn(badges, [{ partner: 'OpenAI', tags: ['Video'] }])
    ).toEqual([
      { type: 'partner', value: 'OpenAI' },
      { type: 'tag', value: 'Video' }
    ])
  })
})
