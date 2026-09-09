import { describe, expect, it } from 'vitest'

import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import { cloudNodeModelCards } from './modelCards'

const locales: Locale[] = ['en', 'zh-CN']
const MEDIA_URL =
  /^https:\/\/media\.comfy\.org\/website\/cloud-nodes\/models\/[\w-]+\.(webp|webm|mp4)$/

const NODES_PER_KEY: Record<string, number> = {
  'cloudNodesLaunch.models.oneNode': 1,
  'cloudNodesLaunch.models.threeNodes': 3
}

describe('cloudNodeModelCards', () => {
  it('declares a media kind that matches the file it points at', () => {
    for (const card of cloudNodeModelCards) {
      const isVideoFile = /\.(webm|mp4)$/.test(card.media.src)
      expect(card.media.kind).toBe(isVideoFile ? 'video' : 'image')
    }
  })

  it('serves every card from the CDN in a renderable format', () => {
    for (const card of cloudNodeModelCards) {
      expect(card.media.src).toMatch(MEDIA_URL)
    }
  })

  it('does not reuse a model image across cards', () => {
    const srcs = cloudNodeModelCards.map((card) => card.media.src)
    expect(new Set(srcs).size).toBe(srcs.length)
  })

  it('covers exactly the eight launch nodes', () => {
    const perCard = cloudNodeModelCards.map(
      (card) => NODES_PER_KEY[card.nodesKey]
    )
    expect(perCard).not.toContain(undefined)
    expect(cloudNodeModelCards).toHaveLength(6)
    expect(perCard.reduce((a, b) => a + b, 0)).toBe(8)
  })

  it.for(locales)('translates every card label for %s', (locale) => {
    for (const card of cloudNodeModelCards) {
      expect(t(card.titleKey, locale)).not.toBe('')
      expect(t(card.nodesKey, locale)).not.toBe('')
    }
  })
})
