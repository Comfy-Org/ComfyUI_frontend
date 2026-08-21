import { describe, expect, it } from 'vitest'
import { displayWidth } from './logger'

describe('displayWidth', () => {
  it('counts plain text by character', () => {
    expect(displayWidth('pnpm dev')).toBe(8)
  })

  it('ignores ANSI colour codes', () => {
    expect(displayWidth('\u001b[36mpnpm dev\u001b[39m')).toBe(8)
  })

  it('counts emoji as two cells', () => {
    expect(displayWidth('👉 go')).toBe(5)
  })

  it('does not count a variation selector', () => {
    expect(displayWidth('⚠️')).toBe(1)
  })
})
