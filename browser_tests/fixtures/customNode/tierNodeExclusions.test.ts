import { describe, expect, it } from 'vitest'

import type { TierNodeExclusion } from '@e2e/fixtures/customNode/tierNodeExclusions'
import {
  eligibleNodeTypesForTier,
  tierNodeExclusionProblems
} from '@e2e/fixtures/customNode/tierNodeExclusions'

const exclusion: TierNodeExclusion = {
  identity: 'example-pack@1.0.0',
  nodeType: 'UnstableNode',
  pack: 'example-pack',
  reason: 'observed instability',
  restore: 'remove after the upstream fix',
  ticket: 'https://linear.app/example/issue/TEST-1',
  tiers: ['S1', 'S3']
}

describe('tier node exclusions', () => {
  it('excludes only the named node from its exact tiers', () => {
    const target = { identity: exclusion.identity, pack: exclusion.pack }
    const nodes = ['StableNode', 'UnstableNode']
    expect(eligibleNodeTypesForTier(target, 'S1', nodes, [exclusion])).toEqual([
      'StableNode'
    ])
    expect(eligibleNodeTypesForTier(target, 'S4', nodes, [exclusion])).toEqual(
      nodes
    )
  })

  it('fails when the pinned artifact or registered node changes', () => {
    expect(
      eligibleNodeTypesForTier(
        { identity: 'example-pack@2.0.0', pack: exclusion.pack },
        'S1',
        [exclusion.nodeType],
        [exclusion]
      )
    ).toEqual([exclusion.nodeType])
    expect(() =>
      eligibleNodeTypesForTier(
        { identity: exclusion.identity, pack: exclusion.pack },
        'S1',
        ['StableNode'],
        [exclusion]
      )
    ).toThrow(/node that no longer registers/)
  })

  it('reports unknown, repinned, and duplicate entries', () => {
    expect(tierNodeExclusionProblems([], [exclusion])).toEqual([
      'example-pack/UnstableNode is not in the manifest'
    ])
    expect(
      tierNodeExclusionProblems(
        [{ identity: 'example-pack@2.0.0', pack: exclusion.pack }],
        [exclusion]
      )
    ).toEqual([
      'example-pack/UnstableNode is pinned to example-pack@1.0.0, but the manifest uses example-pack@2.0.0'
    ])
    expect(
      tierNodeExclusionProblems(
        [{ identity: exclusion.identity, pack: exclusion.pack }],
        [exclusion, exclusion]
      )
    ).toEqual([
      'example-pack/example-pack@1.0.0/UnstableNode/S1 is duplicated',
      'example-pack/example-pack@1.0.0/UnstableNode/S3 is duplicated'
    ])
  })

  it('allows the same pack at another pinned identity', () => {
    expect(
      tierNodeExclusionProblems(
        [
          { identity: exclusion.identity, pack: exclusion.pack },
          { identity: 'example-pack@2.0.0', pack: 'Example-Pack' }
        ],
        [exclusion]
      )
    ).toEqual([])
  })
})
