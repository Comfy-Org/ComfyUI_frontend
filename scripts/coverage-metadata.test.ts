import { describe, expect, it } from 'vitest'

import { parseCoverageMetadata } from './coverage-metadata'

describe('parseCoverageMetadata', () => {
  it('reads the shard accounting written by the packager', () => {
    expect(
      parseCoverageMetadata(
        '{"shardsFound":14,"shardsExpected":16,"complete":false}'
      )
    ).toEqual({ shardsFound: 14, shardsExpected: 16, complete: false })
  })

  // Only `complete` gates the trust decision, so it must survive counts that
  // are absent or the wrong shape rather than being discarded with them.
  it.for([
    ['absent', '{"complete":false}'],
    ['non-numeric', '{"complete":false,"shardsFound":"14"}']
  ])(
    'honours an explicit incomplete flag when counts are %s',
    ([, content]) => {
      expect(parseCoverageMetadata(content)?.complete).toBe(false)
    }
  )

  it('omits counts it cannot read', () => {
    expect(parseCoverageMetadata('{"complete":true}')).toEqual({
      complete: true,
      shardsFound: undefined,
      shardsExpected: undefined
    })
  })

  it.for([
    ['malformed JSON', '{'],
    ['a JSON scalar', '42'],
    ['null', 'null'],
    ['a missing complete flag', '{"shardsFound":16,"shardsExpected":16}'],
    [
      'a non-boolean complete flag',
      '{"shardsFound":16,"shardsExpected":16,"complete":"yes"}'
    ]
  ])('returns null for %s', ([, content]) => {
    expect(parseCoverageMetadata(content)).toBeNull()
  })
})
