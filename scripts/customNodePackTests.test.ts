import { describe, expect, it } from 'vitest'

import { packSpecTestCount } from './customNodePackTests'

describe('packSpecTestCount', () => {
  it.for([
    { pack: 'ComfyUI-Impact-Pack', expected: 2 },
    { pack: 'ComfyUI-VideoHelperSuite', expected: 3 },
    { pack: 'ComfyUI-Easy-Use', expected: 2 },
    { pack: 'ComfyUI-PromptChain', expected: 1 },
    { pack: 'rgthree-comfy', expected: 13 }
  ])('counts $pack pack specs', ({ pack, expected }) => {
    expect(packSpecTestCount([{ pack }])).toBe(expected)
  })

  it('ignores unrelated packs and preserves the calibrated total', () => {
    expect(packSpecTestCount([])).toBe(0)
    expect(packSpecTestCount([{ pack: 'unrelated' }])).toBe(0)
    expect(
      packSpecTestCount([
        { pack: 'comfyui-impact-pack' },
        { pack: 'comfyui-videohelpersuite' },
        { pack: 'comfyui-easy-use' },
        { pack: 'comfyui-promptchain' },
        { pack: 'RGTHREE-COMFY' }
      ])
    ).toBe(21)
  })
})
