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

  it('recognizes a node type named through a local string constant', () => {
    expect(
      handledTypes(`
        const NODE_TYPE = 'Note Plus (mtb)'
        comfy.defs.extend(NODE_TYPE, (builder) => {
          builder.onCreated(() => {})
        })
        comfy.defs.define({ type: NODE_TYPE, execution: 'frontend' })
      `)
    ).toEqual(['Note Plus (mtb)'])
  })
})
