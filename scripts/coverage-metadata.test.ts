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

  // A malformed file must not read as `complete: false`, which would silence
  // E2E reporting indefinitely instead of for one bad run.
  it.for([
    ['malformed JSON', '{'],
    ['a JSON scalar', '42'],
    ['null', 'null'],
    ['a missing complete flag', '{"shardsFound":16,"shardsExpected":16}'],
    [
      'a non-boolean complete flag',
      '{"shardsFound":16,"shardsExpected":16,"complete":"yes"}'
    ],
    ['missing shard counts', '{"complete":true}']
  ])('returns null for %s', ([, content]) => {
    expect(parseCoverageMetadata(content)).toBeNull()
  })
})
