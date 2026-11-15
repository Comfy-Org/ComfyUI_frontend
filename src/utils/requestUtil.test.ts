import { describe, expect, it } from 'vitest'

import { encodeParams } from './requestUtil'

describe('encodeParams', () => {
  it('omits undefined query parameters', () => {
    const tags = ['temp', 'output']

    expect(encodeParams({ after: undefined, tags_any: tags })).toBe(
      'tags_any=output,temp'
    )
    expect(tags).toEqual(['temp', 'output'])
  })
})
