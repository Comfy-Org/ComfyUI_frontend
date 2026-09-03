import { describe, expect, it, vi } from 'vitest'

import type { OutputLocale } from './config'
import type { TranslateBatch, TranslationItem } from './translate'
import { translateItems } from './translate'

const locale: OutputLocale = { code: 'ja', name: 'Japanese' }
const config = {
  maxItemsPerRequest: 40,
  maxSourceCharsPerRequest: 6000,
  requestConcurrency: 2,
  maxTranslationRounds: 3
}

describe('translateItems', () => {
  it('returns translations that pass token validation', async () => {
    const items: TranslationItem[] = [
      { id: '1', context: 'ui.copy', source: 'Copy', preserve: [] }
    ]
    const translateBatch: TranslateBatch = vi.fn(async () => ({
      '1': 'コピー'
    }))

    const results = await translateItems(locale, items, translateBatch, config)

    expect(results.get('1')).toBe('コピー')
  })

  it('retries an item whose translation drops a protected tag', async () => {
    const items: TranslationItem[] = [
      {
        id: '1',
        context: 'ui.readMore',
        source: 'Read <strong>more</strong>',
        preserve: ['<strong>', '</strong>']
      }
    ]
    let call = 0
    const translateBatch: TranslateBatch = vi.fn(async () => {
      call++
      return call === 1
        ? { '1': 'もっと見る' }
        : { '1': '<strong>もっと見る</strong>' }
    })

    const results = await translateItems(locale, items, translateBatch, config)

    expect(results.get('1')).toBe('<strong>もっと見る</strong>')
    expect(translateBatch).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting every retry round', async () => {
    const items: TranslationItem[] = [
      { id: '1', context: 'ui.copy', source: 'Copy', preserve: [] }
    ]
    const translateBatch: TranslateBatch = vi.fn(async () => ({}))

    await expect(
      translateItems(locale, items, translateBatch, config)
    ).rejects.toThrow(/failed for 1 strings/)
    expect(translateBatch).toHaveBeenCalledTimes(config.maxTranslationRounds)
  })
})
