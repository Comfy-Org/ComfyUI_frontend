import { describe, expect, it } from 'vitest'

import { phraseMatches } from './phrase-search'

describe('phraseMatches', () => {
  it.for([
    {
      phrase: 'Edit & clean up photos',
      query: 'clean up a photo',
      found: true
    },
    { phrase: 'Edit & clean up photos', query: 'Clean-up', found: true },
    { phrase: 'Upscale & restore', query: 'upscale & restore', found: true },
    { phrase: '编辑与修整照片', query: '修整', found: true },
    { phrase: 'Upscale & restore', query: 'upscale video', found: false },
    { phrase: 'Upscale & restore', query: ' & ', found: false }
  ])('finds "$phrase" by "$query": $found', ({ phrase, query, found }) => {
    expect(phraseMatches(phrase, query)).toBe(found)
  })
})
