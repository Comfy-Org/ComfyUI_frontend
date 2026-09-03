import { describe, expect, it } from 'vitest'

import { deriveApiMembers } from '../../../scripts/node-api/gen_api_surface.mjs'
import { API_MEMBERS } from './apiSurface'

describe('published API surface', () => {
  it('matches the interfaces it was generated from', () => {
    // The conformance harness rejects converted code that references a member
    // outside this set, so a stale set would either block a valid conversion or
    // wave through an invented member.
    const derived = deriveApiMembers('src/platform/nodeApi')
    const byName = (a: string, b: string) => a.localeCompare(b)
    expect([...API_MEMBERS].sort(byName)).toEqual([...derived].sort(byName))
  })
})
