import { describe, expect, it } from 'vitest'

import { encodeParams } from './requestUtil'

describe('encodeParams', () => {
  it('omits undefined query parameters', () => {
    expect(
      encodeParams({ after: undefined, tags_any: ['temp', 'output'] })
    ).toBe('tags_any=output,temp')
  })
})
