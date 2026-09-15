import { describe, expect, it } from 'vitest'

import { getAgentCards } from './agentCards'

describe('getAgentCards', () => {
  it('pitches the four agent capabilities in order', () => {
    expect(getAgentCards('en').map((card) => card.tag)).toEqual([
      'Creative knowledge',
      'Human-agent Multiplayer',
      'Control & Iterate',
      'Local and Cloud'
    ])
  })

  it('gives every card a title and body to render', () => {
    for (const card of getAgentCards('en')) {
      expect(card.title.length).toBeGreaterThan(0)
      expect(card.body.length).toBeGreaterThan(0)
    }
  })

  it('keeps every tag unique, since the tag is the card key', () => {
    const tags = getAgentCards('en').map((card) => card.tag)

    expect(new Set(tags).size).toBe(tags.length)
  })

  // Pins the card-to-key mapping: a reordered CARD_KEYS or a mistyped key
  // stem would swap a tag onto the wrong title, which comparing en against
  // zh cannot catch.
  it('maps each card to its own zh-CN tag and title', () => {
    expect(getAgentCards('zh-CN')).toMatchObject([
      { tag: '创意知识', title: '最佳实践可以端到端交付' },
      { tag: '人机协同', title: '你们两位同时编辑' },
      { tag: '掌控与迭代', title: '创作始终属于你' },
      { tag: '本地与云端', title: '你在哪里运行，它就在哪里运行' }
    ])
  })

  it('gives every zh-CN card a body to render', () => {
    for (const card of getAgentCards('zh-CN')) {
      expect(card.body.length).toBeGreaterThan(0)
    }
  })
})
