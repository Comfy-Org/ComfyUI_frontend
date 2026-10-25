import { describe, expect, it } from 'vitest'

import { routerSavesAssets } from './asset-saving'

describe('routerSavesAssets', () => {
  it.for([
    ['bfl/flux-2-pro', true],
    ['fal/openai/gpt-image-2', true],
    ['fal/bytedance/seedance-2.0', true],
    ['bfl/flux-2', false],
    ['google/veo-3.1', false],
    ['bytedance/seedream-4', false],
    [undefined, false]
  ] as const)('answers %s with %s', ([routerId, expected]) => {
    expect(routerSavesAssets(routerId)).toBe(expected)
  })
})
