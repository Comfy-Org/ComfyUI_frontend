import { describe, expect, it } from 'vitest'

import { deriveSections } from './contentSections'

/**
 * Section structure is derived from the key space, which every dictionary
 * shares, so it must not depend on which dictionary happens to be loaded.
 *
 * The regression: `inferBlockType` called `t()` with no locale, so it asked for
 * English. In the browser only the document's own dictionary is loaded, so on
 * `/zh-CN/privacy-policy/` that threw, the `ContentSection` island failed to
 * hydrate, and the policy body vanished — server-rendered correctly, then wiped
 * by the client.
 */
describe('deriveSections', () => {
  it('derives the same structure whichever locale is asked for', () => {
    const english = deriveSections('privacy', 'en')
    const chinese = deriveSections('privacy', 'zh-CN')
    const japanese = deriveSections('privacy', 'ja')

    expect(english.length).toBeGreaterThan(0)
    expect(chinese.map((s) => s.id)).toEqual(english.map((s) => s.id))
    expect(japanese.map((s) => s.id)).toEqual(english.map((s) => s.id))
  })

  it('reads block types from the locale it is given', () => {
    const chinese = deriveSections('privacy', 'zh-CN')

    // Every block resolves to a type; none is left undefined because a lookup
    // silently failed.
    for (const section of chinese) {
      for (const block of section.blocks) {
        expect(block.type, section.id).toBeTruthy()
      }
    }
  })

  it('defaults to English when no locale is given', () => {
    expect(deriveSections('privacy').map((s) => s.id)).toEqual(
      deriveSections('privacy', 'en').map((s) => s.id)
    )
  })
})
