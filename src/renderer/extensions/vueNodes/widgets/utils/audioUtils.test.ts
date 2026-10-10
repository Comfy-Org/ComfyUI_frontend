import { describe, expect, it } from 'vitest'

import { getResourceURL } from './audioUtils'

describe('getResourceURL', () => {
  it('builds a /view URL with only the file params', () => {
    expect(getResourceURL('audio', 'a b.wav', 'output')).toBe(
      '/view?filename=a%20b.wav&type=output&subfolder=audio'
    )
  })
})
