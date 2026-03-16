import { describe, expect, it } from 'vitest'

import { normalizeTag, normalizeTags } from './normalizeTags'

describe('normalizeTag', () => {
  it.for([
    { input: 'Text to Image', expected: 'text-to-image', name: 'spaces' },
    { input: 'API', expected: 'api', name: 'single word' },
    {
      input: 'text-to-image',
      expected: 'text-to-image',
      name: 'already normalized'
    },
    {
      input: 'Image   Upscale',
      expected: 'image-upscale',
      name: 'multiple spaces'
    },
    {
      input: '  Video  ',
      expected: 'video',
      name: 'leading/trailing whitespace'
    },
    { input: '   ', expected: '', name: 'whitespace-only' }
  ])('$name: "$input" → "$expected"', ({ input, expected }) => {
    expect(normalizeTag(input)).toBe(expected)
  })
})

describe('normalizeTags', () => {
  it.for([
    {
      name: 'normalizes all tags',
      input: ['Text to Image', 'API', 'Video'],
      expected: ['text-to-image', 'api', 'video']
    },
    {
      name: 'deduplicates tags with the same slug',
      input: ['Text to Image', 'Text-to-Image'],
      expected: ['text-to-image']
    },
    {
      name: 'filters out empty tags',
      input: ['Video', '', '  ', 'Audio'],
      expected: ['video', 'audio']
    },
    {
      name: 'returns empty array for empty input',
      input: [],
      expected: []
    }
  ])('$name', ({ input, expected }) => {
    expect(normalizeTags(input)).toEqual(expected)
  })
})
