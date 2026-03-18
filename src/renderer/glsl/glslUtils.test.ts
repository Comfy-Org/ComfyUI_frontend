import { describe, expect, it } from 'vitest'

import {
  detectOutputCount,
  detectPassCount,
  hasVersionDirective
} from '@/renderer/glsl/glslUtils'

describe('detectOutputCount', () => {
  it('returns 1 when no fragColor declarations found', () => {
    expect(detectOutputCount('void main() { gl_FragColor = vec4(1); }')).toBe(1)
  })

  it('returns 1 for fragColor0 only', () => {
    expect(detectOutputCount('fragColor0 = vec4(1.0);')).toBe(1)
  })

  it('returns 2 for fragColor0 and fragColor1', () => {
    expect(
      detectOutputCount('fragColor0 = vec4(1.0);\nfragColor1 = vec4(0.0);')
    ).toBe(2)
  })

  it('returns 4 for all four outputs', () => {
    const src = `
      fragColor0 = vec4(1.0);
      fragColor1 = vec4(0.5);
      fragColor2 = vec4(0.3);
      fragColor3 = vec4(0.0);
    `
    expect(detectOutputCount(src)).toBe(4)
  })

  it('caps at 4 even if higher indices appear', () => {
    expect(detectOutputCount('fragColor5 = vec4(1.0);')).toBe(4)
  })

  it('handles non-sequential output indices', () => {
    expect(
      detectOutputCount('fragColor0 = vec4(1.0); fragColor3 = vec4(0.0);')
    ).toBe(4)
  })
})

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

describe('hasVersionDirective', () => {
  it('returns true for #version 300 es', () => {
    expect(hasVersionDirective('#version 300 es\nprecision highp float;')).toBe(
      true
    )
  })

  it('returns false for desktop GLSL', () => {
    expect(hasVersionDirective('#version 330 core\nvoid main() {}')).toBe(false)
  })

  it('returns false for no version directive', () => {
    expect(hasVersionDirective('void main() { }')).toBe(false)
  })
})
