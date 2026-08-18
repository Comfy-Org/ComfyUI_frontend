import { describe, expect, it } from 'vitest'

import { handledTypes } from '../../../../../scripts/magic-patch/node_status.mjs'

describe('node status', () => {
  it('recognizes every literal node type in an extension array', () => {
    expect(
      handledTypes(`
        comfy.defs.extend(['ImageList', "MaskList", 'AnyList'], (builder) => {
          builder.onCreated(() => {})
        })
      `)
    ).toEqual(['ImageList', 'MaskList', 'AnyList'])
  })
})
