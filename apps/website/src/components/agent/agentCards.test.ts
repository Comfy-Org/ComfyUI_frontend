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

  it('translates every field for zh-CN', () => {
    const en = getAgentCards('en')
    const zh = getAgentCards('zh-CN')

    expect(zh).toHaveLength(en.length)
    for (const [index, card] of zh.entries()) {
      expect(card.tag).not.toBe(en[index].tag)
      expect(card.title).not.toBe(en[index].title)
      expect(card.body).not.toBe(en[index].body)
    }
  })
})
