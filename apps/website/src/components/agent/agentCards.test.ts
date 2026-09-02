import { describe, expect, it } from 'vitest'

import { agentCards } from './agentCards'

describe('agentCards', () => {
  it('pitches the four agent capabilities in order', () => {
    expect(agentCards.map((card) => card.tag)).toEqual([
      'Creative knowledge',
      'Human-agent Multiplayer',
      'Control & Iterate',
      'Local and Cloud'
    ])
  })

  it('gives every card a title and body to render', () => {
    for (const card of agentCards) {
      expect(card.title.length).toBeGreaterThan(0)
      expect(card.body.length).toBeGreaterThan(0)
    }
  })

  it('keeps every tag unique, since the tag is the card key', () => {
    const tags = agentCards.map((card) => card.tag)

    expect(new Set(tags).size).toBe(tags.length)
  })
})
