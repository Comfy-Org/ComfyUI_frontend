import { describe, expect, it } from 'vitest'

import { isLikelyEduEmail } from '@/platform/cloud/subscription/utils/eduEmail'

describe('isLikelyEduEmail', () => {
  it.for([
    ['student@harvard.edu', true],
    ['grad@cs.ox.ac.uk', true],
    ['ug@unimelb.edu.au', true],
    ['user@gmail.com', false],
    ['spoof@evil.edu.com', false],
    ['vanity@cool.ac', false],
    // Known false positive: 2-letter cc heuristic; server refuses the marker.
    ['edge@spam.ac.io', true],
    // ROR-only institutions are a server-side match; no client nudge.
    ['phd@ethz.ch', false],
    ['', false]
  ] as const)('%s -> %s', ([email, expected]) => {
    expect(isLikelyEduEmail(email)).toBe(expected)
  })

  it('handles null and undefined', () => {
    expect(isLikelyEduEmail(null)).toBe(false)
    expect(isLikelyEduEmail(undefined)).toBe(false)
  })
})
