import { describe, expect, it, vi } from 'vitest'

import type { OutputLocale } from './config'
import type { ReviewBatch, ReviewItem } from './review'
import { reviewItems } from './review'

const locale: OutputLocale = { code: 'ja', name: 'Japanese' }
const config = { maxItemsPerRequest: 40, maxSourceCharsPerRequest: 6000 }

const item: ReviewItem = {
  id: '1',
  context: 'ui.copy',
  source: 'Copy',
  translation: 'コピー'
}

describe('reviewItems', () => {
  it('passes through a positive verdict', async () => {
    const reviewBatch: ReviewBatch = vi.fn(
      async () => new Map([['1', { pass: true }]])
    )

    const results = await reviewItems(locale, [item], reviewBatch, config)

    expect(results.get('1')).toEqual({ pass: true })
  })

  it('rejects an item the reviewer never returned a verdict for', async () => {
    const reviewBatch: ReviewBatch = vi.fn(async () => new Map())

    const results = await reviewItems(locale, [item], reviewBatch, config)

    expect(results.get('1')).toEqual({
      pass: false,
      reason: 'reviewer returned no verdict'
    })
  })

  it('rejects every item in a chunk whose review call throws', async () => {
    const reviewBatch: ReviewBatch = vi.fn(async () => {
      throw new Error('rate limited')
    })

    const results = await reviewItems(locale, [item], reviewBatch, config)

    expect(results.get('1')).toEqual({ pass: false, reason: 'rate limited' })
  })
})
