import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useSelectSearch } from './useSelectSearch'

const options = [
  { name: 'Euler', value: 'euler' },
  { name: 'DPM++ 2M', value: 'dpmpp_2m' },
  { name: 'Heun', value: 'heun' }
]

describe('useSelectSearch', () => {
  it.for([
    { query: '', expected: ['euler', 'dpmpp_2m', 'heun'] },
    { query: '   ', expected: ['euler', 'dpmpp_2m', 'heun'] },
    { query: 'heun', expected: ['heun'] },
    { query: 'HEUN', expected: ['heun'] },
    { query: 'dpmpp', expected: ['dpmpp_2m'] },
    { query: 'zzzz', expected: [] }
  ])('"$query" matches $expected', ({ query, expected }) => {
    const filtered = useSelectSearch(ref(query), options)
    expect(filtered.value.map(({ value }) => value)).toEqual(expected)
  })
})
