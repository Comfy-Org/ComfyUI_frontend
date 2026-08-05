import { describe, expect, it } from 'vitest'

import { deriveApiMembers } from '../../../scripts/magic-patch/gen_api_surface.mjs'
import { API_MEMBERS } from './apiSurface'

describe('published API surface', () => {
  it('matches the interfaces it was generated from', () => {
    // The conformance harness rejects converted code that references a member
    // outside this set, so a stale set would either block a valid conversion or
    // wave through an invented member.
    const derived = deriveApiMembers('src/platform/nodeApi')
    expect([...API_MEMBERS].sort()).toEqual([...derived].sort())
  })
})
