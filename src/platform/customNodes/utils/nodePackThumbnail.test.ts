import { describe, expect, it } from 'vitest'

import { createNodePackThumbnail } from './nodePackThumbnail'

describe('createNodePackThumbnail', () => {
  it('is deterministic and normalizes the stable identity', () => {
    const expected = createNodePackThumbnail('Example', 'Image Tools')
    expect(
      createNodePackThumbnail('  ＥＸＡＭＰＬＥ  ', 'Image Tools')
    ).toEqual(expected)
    expect(createNodePackThumbnail('Example', 'Image Tools')).toEqual(expected)
  })

  it('keeps colors and geometry when a display name changes', () => {
    const before = createNodePackThumbnail('owner/pack', 'Old Name')
    const after = createNodePackThumbnail('owner/pack', 'New Name')
    expect(after.palette).toBe(before.palette)
    expect(after.background).toBe(before.background)
    expect(after.motif).toBe(before.motif)
    expect(after.monogram).not.toBe(before.monogram)
  })

  it('uses all curated palettes, motifs, solid fills and gradients', () => {
    const artworks = Array.from({ length: 200 }, (_, index) =>
      createNodePackThumbnail(`pack-${index}`)
    )
    expect(new Set(artworks.map((artwork) => artwork.palette)).size).toBe(8)
    expect(new Set(artworks.map((artwork) => artwork.motif)).size).toBe(3)
    expect(new Set(artworks.map((artwork) => artwork.background))).toEqual(
      new Set(['gradient', 'solid'])
    )
  })

  it('provides self-contained softened colors without theme tokens or RGB extremes', () => {
    for (let index = 0; index < 200; index++) {
      const { palette, foreground } = createNodePackThumbnail(`pack-${index}`)
      for (const color of [...Object.values(palette), foreground]) {
        expect(color).toMatch(/^#[\da-f]{6}$/i)
        for (const channel of color.slice(1).match(/../g) ?? []) {
          expect(parseInt(channel, 16)).toBeGreaterThan(0)
          expect(parseInt(channel, 16)).toBeLessThan(255)
        }
      }
    }
  })

  it.for([
    ['ComfyUI-VideoHelperSuite', 'video'],
    ['ComfyUI-Audio', 'audio'],
    ['Color Match', 'palette'],
    ['Prompt Wildcards', 'text'],
    ['Image Upscale', 'image'],
    ['LoRA Loader', 'layers'],
    ['LoRA Manager', 'layers'],
    ['Essentials', 'tools'],
    ['Unrecognized Pack', 'network']
  ])('selects a topic icon for %s', ([name, icon]) => {
    expect(createNodePackThumbnail(name).icon).toBe(icon)
  })

  it.for([
    ['ComfyUI-VideoHelperSuite', 'VHS'],
    ['ComfyUI_Crystools', 'CR'],
    ['Image tools and extras', 'ITA'],
    ['色彩 工具', '色工'],
    ['   ', 'CN'],
    ['✨', 'CN']
  ])('creates a bounded monogram for %s', ([name, monogram]) => {
    expect(createNodePackThumbnail(name).monogram).toBe(monogram)
  })

  it('bounds untrusted names and never uses them as colors or SVG markup', () => {
    const identity = 'a'.repeat(512)
    expect(createNodePackThumbnail(identity + 'ignored')).toEqual(
      createNodePackThumbnail(identity)
    )
    const artwork = createNodePackThumbnail(
      '<script>alert(1)</script>'.repeat(1000)
    )
    expect(Array.from(artwork.monogram).length).toBeLessThanOrEqual(3)
    expect(artwork.monogram).toMatch(/^[\p{L}\p{N}]+$/u)
    expect(Object.values(artwork.palette).join('')).not.toContain('script')
    expect(artwork.icon).toBe('network')
  })
})
