import everforestDark from 'shiki/themes/everforest-dark.mjs'
import { describe, expect, it } from 'vitest'

import { highlightInline, highlightTokens } from './highlight'

const COMFY_INK = '#211927'

function relativeLuminance(color: string): number {
  const [red, green, blue] = [1, 3, 5]
    .map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    )
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background)
  ].sort((left, right) => right - left)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('highlightInline', () => {
  it('returns tokenized spans without a wrapper element', () => {
    const html = highlightInline('{ "gpu": "H100" }', 'json')

    expect(html).toContain('<span')
    expect(html).not.toContain('<pre')
    expect(html).toContain('H100')
  })

  it('supports every bundled grammar', () => {
    for (const lang of [
      'javascript',
      'python',
      'shell',
      'typescript'
    ] as const) {
      expect(highlightInline('echo hi', lang)).toContain('<span')
    }
  })

  it('returns colored tokens without changing the source text', () => {
    const code = 'const answer: number = 42\nconsole.log(answer)'
    const tokens = highlightTokens(code, 'typescript')
    const colors = tokens
      ?.map((token) => token.color)
      .filter((color) => color !== undefined)

    expect(tokens?.map((token) => token.content).join('')).toBe(code)
    expect(new Set(colors).size).toBeGreaterThan(1)
  })

  it('skips highlighting for oversized payloads', () => {
    expect(highlightInline('x'.repeat(129 * 1024), 'json')).toBeNull()
    expect(highlightTokens('界'.repeat(44 * 1024), 'json')).toBeNull()
  })

  it('keeps every token color readable against Comfy ink', () => {
    const colors = new Set(
      (everforestDark.tokenColors ?? [])
        .map((token) => token.settings.foreground)
        .filter((color): color is string => typeof color === 'string')
    )

    expect(colors.size).toBeGreaterThan(1)
    for (const color of colors) {
      expect(contrastRatio(color, COMFY_INK)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
