import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  CUSTOM_NODE_TIER_NODE_EXCLUSIONS,
  eligibleNodeTypesForTier,
  tierNodeExclusionProblems
} from '@e2e/fixtures/customNode/tierNodeExclusions'

test.describe('tier node exclusions', () => {
  test('excludes only the named node from its exact tiers', () => {
    expect(
      eligibleNodeTypesForTier(
        { identity: 'comfyui-itools@0.6.8', pack: 'comfyui-itools' },
        'S1',
        ['iToolsAddOverlay', 'iToolsCropImage']
      )
    ).toEqual(['iToolsAddOverlay'])
    expect(
      eligibleNodeTypesForTier(
        { identity: 'comfyui-itools@0.6.8', pack: 'comfyui-itools' },
        'S4',
        ['iToolsAddOverlay', 'iToolsCropImage']
      )
    ).toEqual(['iToolsAddOverlay'])
  })

  test('fails when the pinned artifact or registered node changes', () => {
    expect(() =>
      eligibleNodeTypesForTier(
        { identity: 'comfyui-itools@0.6.9', pack: 'comfyui-itools' },
        'S1',
        ['iToolsCropImage']
      )
    ).toThrow(/manifest now uses comfyui-itools@0\.6\.9/)
    expect(() =>
      eligibleNodeTypesForTier(
        { identity: 'comfyui-itools@0.6.8', pack: 'comfyui-itools' },
        'S1',
        ['iToolsAddOverlay']
      )
    ).toThrow(/node that no longer registers/)
  })

  test('reports unknown and repinned entries and has unique tier keys', () => {
    expect(
      tierNodeExclusionProblems([
        { identity: 'comfyui-itools@0.6.9', pack: 'comfyui-itools' }
      ])
    ).toEqual([
      'comfyui-itools/iToolsCropImage is pinned to comfyui-itools@0.6.8, but the manifest now uses comfyui-itools@0.6.9'
    ])
    expect(tierNodeExclusionProblems([])).toEqual([
      'comfyui-itools/iToolsCropImage is not in the manifest'
    ])
    expect(new Set(CUSTOM_NODE_TIER_NODE_EXCLUSIONS[0].tiers).size).toBe(
      CUSTOM_NODE_TIER_NODE_EXCLUSIONS[0].tiers.length
    )
  })
})
