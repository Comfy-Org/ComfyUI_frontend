import { describe, expect, it } from 'vitest'

import { getResourceURL } from './audioUtils'

describe('getResourceURL', () => {
  it('builds a /view URL with only the file params', () => {
    expect(getResourceURL('audio', 'a b.wav', 'output')).toBe(
      '/view?filename=a%20b.wav&type=output&subfolder=audio'
    )
  })

  it('carries the content version so a rewritten file gets a new URL', () => {
    expect(getResourceURL('', 'out.wav', 'output', '18dd-46')).toBe(
      '/view?filename=out.wav&type=output&subfolder=&version=18dd-46'
    )
  })
})
