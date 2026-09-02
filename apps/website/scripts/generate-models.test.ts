import { describe, expect, it } from 'vitest'
import { extractApiModels } from './generate-models'

describe('extractApiModels', () => {
  it('correctly matches longest provider prefix when multiple providers share prefixes', () => {
    // Tests that 'kling2_6' matches first over 'kling2' and 'kling'
    const files = [
      'api_kling2_6_i2v.json',
      'api_kling2_t2v.json',
      'api_kling_motion.json'
    ]

    const results = extractApiModels(files)

    // Check that we get 1 of each intended slug
    const kling26 = results.find((r) => r.slug === 'kling-2-6')

    // Some slugs map to the same parent, but let's just count them
    // kling2_6 -> 'kling-2-6'
    // kling2 -> 'kling-ai'
    // kling -> 'kling-ai'

    expect(kling26?.templateCount).toBe(1)

    // Because kling and kling2 both map to 'kling-ai', they should be aggregated
    const klingParent = results.find((r) => r.slug === 'kling-ai')
    expect(klingParent?.templateCount).toBe(2)
  })

  it('aggregates duplicate provider slugs correctly', () => {
    const files = [
      'api_nano_banana_pro.json',
      'api_nano_banana_pro_2.json',
      'api_nano_banana_2_lite.json'
    ]

    const results = extractApiModels(files)

    // 'nano' maps to 'nano-banana'
    const nanoParent = results.find((r) => r.slug === 'nano-banana')
    expect(nanoParent?.templateCount).toBe(2)

    // 'nano_banana_2' maps to 'nano-banana-2'
    const nano2 = results.find((r) => r.slug === 'nano-banana-2')
    expect(nano2?.templateCount).toBe(1)
  })

  it('maps current Meshy 7 and Wan 3.0 templates at provider boundaries', () => {
    const files = [
      'api_meshy7_image_to_model.json',
      'api_meshy7_text_to_model.json',
      'api_wan3_0_i2v.json',
      'api_wan3_0_r2v.json',
      'api_wan3_0_t2v.json'
    ]

    expect(extractApiModels(files)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'meshy-7', templateCount: 2 }),
        expect.objectContaining({ slug: 'wan-3-0', templateCount: 3 })
      ])
    )
  })

  it('removes .json extensions regardless of casing', () => {
    const files = ['api_KLING.JSON']

    const results = extractApiModels(files)
    const klingParent = results.find((r) => r.slug === 'kling-ai')
    expect(klingParent?.templateCount).toBe(1)
  })

  it('lowercases filenames during prefix matching', () => {
    const files = ['api_KLING_3_0_test.json']
    const results = extractApiModels(files)
    const kling30 = results.find((r) => r.slug === 'kling-3-0')
    expect(kling30?.templateCount).toBe(1)
  })

  it('ignores known upstream typos (king, from)', () => {
    const files = ['api_king_o3_t2v.json', 'api_from_photo_2.json']

    // Shouldn't throw, should just return empty
    const results = extractApiModels(files)
    expect(results).toHaveLength(0)
  })

  it('throws a fatal error when unmapped prefixes are encountered', () => {
    const files = ['api_totally_unknown_provider.json']

    expect(() => extractApiModels(files)).toThrow(
      /totally_unknown_provider \(from api_totally_unknown_provider\.json\)/
    )
  })
})
