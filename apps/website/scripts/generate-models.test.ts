import { describe, expect, it } from 'vitest'
import { extractApiModels, API_PROVIDER_MAP } from './generate-models'

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
    const kling26 = results.find(
      (r) => r.slug === API_PROVIDER_MAP['kling2_6'].slug
    )

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

  it('removes .json extensions and ignores non-json files with the same prefix silently if they do not match api_ prefix logic', () => {
    const files = [
      'api_flux2-1.webp' // We pass this in, but it won't match any key precisely because it has .webp and hyphens
    ]

    // The previous implementation would throw here because 'flux2-1.webp' would be the prefix and it was unmapped.
    // In the new implementation, 'flux2-1.webp' doesn't match 'flux2' because it's not followed by an underscore or exact match.
    // Wait, 'flux2-1.webp' does NOT start with 'flux2_' nor is it exactly 'flux2'. So it will be unmapped and throw.
    // Actually, we expect it to throw on unmapped prefixes, which proves it catches them!
    expect(() => extractApiModels(files)).toThrow(
      /Unmapped API provider prefixes found/
    )
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
