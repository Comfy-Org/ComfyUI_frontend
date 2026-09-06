import { describe, expect, it } from 'vitest'

import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import { cloudNodeModelCards } from './modelCards'

const locales: Locale[] = ['en', 'zh-CN']
const MEDIA_URL =
  /^https:\/\/media\.comfy\.org\/website\/cloud-nodes\/models\/[\w-]+\.(webp|webm|mp4)$/

describe('cloudNodeModelCards', () => {
  it('serves every card from the CDN in a renderable format', () => {
    for (const card of cloudNodeModelCards) {
      expect(card.mediaSrc).toMatch(MEDIA_URL)
    }
  })

  it('does not reuse a model image across cards', () => {
    const srcs = cloudNodeModelCards.map((card) => card.mediaSrc)
    expect(new Set(srcs).size).toBe(srcs.length)
  })

  // Six models back the eight nodes we ship, because MiniMax H3 backs three.
  // If this drifts, the grid and the copy disagree about the launch lineup.
  it('covers exactly the eight launch nodes', () => {
    const perCard = cloudNodeModelCards.map((card) =>
      card.nodesKey.endsWith('threeNodes') ? 3 : 1
    )
    expect(cloudNodeModelCards).toHaveLength(6)
    expect(perCard.reduce((a, b) => a + b, 0)).toBe(8)
  })

  it.each(locales)('translates every card label for %s', (locale) => {
    for (const card of cloudNodeModelCards) {
      expect(t(card.titleKey, locale)).not.toBe('')
      expect(t(card.nodesKey, locale)).not.toBe('')
    }
  })
})
