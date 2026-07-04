import { describe, expect, it } from 'vitest'

import { resolveBakedRender } from './heroGraphData'

describe('resolveBakedRender', () => {
  const keys = new Set([
    'portrait/cyberpunk',
    'portrait/cyberpunk/neon',
    'vase/film'
  ])

  it('prefers the exact preset + light-mode render', () => {
    expect(resolveBakedRender('portrait', 'cyberpunk', 'neon', keys)).toEqual({
      src: '/images/hero/output-portrait-cyberpunk-neon.webp',
      includesLight: true
    })
  })

  it('falls back to the preset-only render for unlisted light modes', () => {
    expect(resolveBakedRender('portrait', 'cyberpunk', 'rim', keys)).toEqual({
      src: '/images/hero/output-portrait-cyberpunk.webp',
      includesLight: false
    })
  })

  it('returns null when no render exists for the combo', () => {
    expect(resolveBakedRender('deer', 'dream', 'soft', keys)).toBeNull()
    expect(resolveBakedRender('vase', 'cyberpunk', 'neon', keys)).toBeNull()
  })
})
