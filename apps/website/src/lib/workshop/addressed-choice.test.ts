import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useAddressedChoice, withChoice } from './addressed-choice'

describe('withChoice', () => {
  it.for([
    {
      from: 'https://x/hub/?task=upscale&q=a',
      key: 'audio',
      to: 'https://x/hub/?task=audio&q=a'
    },
    {
      from: 'https://x/hub/?type=workflows',
      key: 'upscale',
      to: 'https://x/hub/?type=workflows&task=upscale'
    },
    { from: 'https://x/hub/?task=audio', key: 'all', to: 'https://x/hub/' }
  ])('writes $key over $from', ({ from, key, to }) => {
    expect(withChoice(from, 'task', key)).toBe(to)
  })
})

describe('useAddressedChoice', () => {
  it.for([
    { search: '?type=video', choice: 'video' },
    { search: '?type=audio', choice: 'all' },
    { search: '?type=workflows', choice: 'all' },
    { search: '', choice: 'all' }
  ])('reads "$search" as $choice', ({ search, choice }) => {
    const { choice: read, readAddress } = useAddressedChoice(
      'type',
      ['image', 'video', 'audio'] as const,
      ref(true),
      (key) => key !== 'audio'
    )

    readAddress(search)

    expect(read.value).toBe(choice)
  })
})
