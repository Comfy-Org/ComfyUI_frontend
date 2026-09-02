import { describe, expect, it } from 'vitest'

import { detectPassCount } from '@/renderer/glsl/glslUtils'

describe('detectPassCount', () => {
  it('returns 1 when no pragma found', () => {
    expect(detectPassCount('void main() {}')).toBe(1)
  })

  it('parses #pragma passes N', () => {
    expect(detectPassCount('#pragma passes 5\nvoid main() {}')).toBe(5)
  })

  it('returns at least 1 even with #pragma passes 0', () => {
    expect(detectPassCount('#pragma passes 0')).toBe(1)
  })

  it('handles extra whitespace in pragma', () => {
    expect(detectPassCount('#pragma   passes   10')).toBe(10)
  })
})
