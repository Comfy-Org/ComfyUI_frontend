import { describe, expect, it } from 'vitest'

import { tokenizeSegments } from './codeTokens'

const segments = [
  'run(\n    "',
  { values: ['model-a', 'model-b'], highlight: true },
  '",\n    provider="',
  { values: ['fal', 'replicate'] },
  '",\n)'
]

function text(group: { tokens: readonly { content: string }[] }): string {
  return group.tokens.map((token) => token.content).join('')
}

describe('tokenizeSegments', () => {
  it('returns one group per segment whose text round-trips the picked sample', () => {
    const groups = tokenizeSegments(segments, 'python', (values) => values[1])

    expect(groups.map((group) => group.kind)).toEqual([
      'static',
      'cycle',
      'static',
      'cycle',
      'static'
    ])
    expect(groups.map(text).join('')).toBe(
      'run(\n    "model-b",\n    provider="replicate",\n)'
    )
    expect(groups[1]).toMatchObject({ value: 'model-b', highlight: true })
    expect(groups[3]).toMatchObject({ value: 'replicate', highlight: false })
  })

  it('colors tokens that straddle segment boundaries as one string literal', () => {
    const groups = tokenizeSegments(segments, 'python', (values) => values[0])

    const openingQuote = groups[0].tokens.at(-1)
    const cycledValue = groups[1].tokens[0]
    const closingQuote = groups[2].tokens[0]

    expect(openingQuote?.content).toBe('"')
    expect(cycledValue.color).toBeDefined()
    expect(cycledValue.color).toBe(openingQuote?.color)
    expect(cycledValue.color).toBe(closingQuote.color)
  })
})
