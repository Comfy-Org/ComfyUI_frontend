import { afterEach, describe, expect, it } from 'vitest'

import { readDesignToken, readDesignTokenRgba } from './designTokens'

afterEach(() => {
  document.documentElement.removeAttribute('style')
})

const define = (name: string, value: string) =>
  document.documentElement.style.setProperty(name, value)

describe('readDesignToken', () => {
  it('falls through to the next token when the one before it is unset', () => {
    define('--color-smoke-800', '#454545')

    expect(
      readDesignToken('--color-muted-foreground', '--color-smoke-800')
    ).toBe('#454545')
  })

  it('prefers the first token that has a value', () => {
    define('--color-muted-foreground', '#8a8a8a')
    define('--color-smoke-800', '#454545')

    expect(
      readDesignToken('--color-muted-foreground', '--color-smoke-800')
    ).toBe('#8a8a8a')
  })

  it('returns an empty string when no name resolves', () => {
    expect(readDesignToken('--color-muted-foreground')).toBe('')
  })
})

describe('readDesignTokenRgba', () => {
  it('applies the alpha to a token written as hex', () => {
    define('--color-primary-comfy-yellow', '#f2ff59')

    expect(readDesignTokenRgba('--color-primary-comfy-yellow', 0.18)).toBe(
      'rgba(242, 255, 89, 0.18)'
    )
  })

  it('applies the alpha to a token written as rgb()', () => {
    define('--color-primary-comfy-yellow', 'rgb(242, 255, 89)')

    expect(readDesignTokenRgba('--color-primary-comfy-yellow', 0.9)).toBe(
      'rgba(242, 255, 89, 0.9)'
    )
  })

  it('returns an empty string for a token it cannot parse', () => {
    define('--color-primary-comfy-yellow', 'hsl(65 100% 67%)')

    expect(readDesignTokenRgba('--color-primary-comfy-yellow', 0.5)).toBe('')
  })
})
