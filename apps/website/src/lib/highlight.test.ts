import { describe, expect, it } from 'vitest'

import { highlightInline, highlightTokens } from './highlight'

describe('highlightInline', () => {
  it('returns tokenized spans without a wrapper element', async () => {
    const html = await highlightInline('{ "gpu": "H100" }', 'json')

    expect(html).toContain('<span')
    expect(html).not.toContain('<pre')
    expect(html).toContain('H100')
  })

  it('loads each supported grammar on demand', async () => {
    for (const lang of [
      'javascript',
      'python',
      'shell',
      'typescript'
    ] as const) {
      expect(await highlightInline('echo hi', lang)).toContain('<span')
    }
  })

  it('returns colored tokens without changing the source text', async () => {
    const code = 'const answer: number = 42\nconsole.log(answer)'
    const tokens = await highlightTokens(code, 'typescript')
    const colors = tokens
      ?.map((token) => token.color)
      .filter((color) => color !== undefined)

    expect(tokens?.map((token) => token.content).join('')).toBe(code)
    expect(new Set(colors).size).toBeGreaterThan(1)
  })

  it('skips highlighting for oversized payloads', async () => {
    expect(await highlightInline('x'.repeat(129 * 1024), 'json')).toBeNull()
  })
})
