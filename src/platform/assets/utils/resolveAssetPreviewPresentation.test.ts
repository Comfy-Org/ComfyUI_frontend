import { describe, expect, it, vi } from 'vitest'

import type { AssetPreviewSource } from '@/platform/assets/utils/resolveAssetPreviewPresentation'
import { resolveAssetPreviewPresentation } from '@/platform/assets/utils/resolveAssetPreviewPresentation'

function base(overrides: Partial<AssetPreviewSource> = {}): AssetPreviewSource {
  return {
    name: 'asset.bin',
    display_name: 'Display',
    ...overrides
  }
}

const t = (key: string) => (key === 'assets.fallbackAlt' ? 'Asset' : key)

describe('resolveAssetPreviewPresentation', () => {
  it('prefers thumbnail_url over preview_url for image mime', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'x.png',
        mime_type: 'image/png',
        thumbnail_url: 'https://t.example/thumb.png',
        preview_url: 'https://p.example/full.png'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'image',
      url: 'https://t.example/thumb.png',
      alt: 'Display'
    })
  })

  it('uses preview_url when thumbnail is missing', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'x.png',
        mime_type: 'image/png',
        preview_url: 'https://p.example/full.png'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'image',
      url: 'https://p.example/full.png',
      alt: 'Display'
    })
  })

  it('returns placeholder when image mime has no URLs', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'x.png',
        mime_type: 'image/jpeg'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'placeholder',
      icon: expect.stringContaining('lucide'),
      alt: 'Display',
      reason: 'missing_url'
    })
  })

  it('returns placeholder when both URLs missing for image extension', () => {
    const p = resolveAssetPreviewPresentation(base({ name: 'photo.png' }), t)
    expect(p).toEqual({
      kind: 'placeholder',
      icon: expect.stringContaining('lucide'),
      alt: 'Display',
      reason: 'missing_url'
    })
  })

  it('video mime uses thumbnail as poster raster only', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'clip.mp4',
        mime_type: 'video/mp4',
        thumbnail_url: 'https://t.example/poster.jpg',
        preview_url: 'https://p.example/clip.mp4'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'image',
      url: 'https://t.example/poster.jpg',
      alt: 'Display'
    })
  })

  it('video mime without thumbnail is placeholder with missing_url', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'clip.mp4',
        mime_type: 'video/mp4',
        preview_url: 'https://p.example/clip.mp4'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'placeholder',
      icon: expect.stringContaining('video'),
      alt: 'Display',
      reason: 'missing_url'
    })
  })

  it('unknown mime falls back to extension for image', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'shot.png',
        mime_type: 'application/octet-stream',
        preview_url: 'https://p.example/shot.png'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'image',
      url: 'https://p.example/shot.png',
      alt: 'Display'
    })
  })

  it('video extension uses thumbnail only not preview alone', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'clip.mp4',
        preview_url: 'https://p.example/clip.mp4'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'placeholder',
      icon: expect.stringContaining('video'),
      alt: 'Display',
      reason: 'missing_url'
    })
  })

  it('video extension with thumbnail yields image poster', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'clip.mp4',
        thumbnail_url: 'https://t.example/poster.png'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'image',
      url: 'https://t.example/poster.png',
      alt: 'Display'
    })
  })

  it('model-like other extension uses any raster URL', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'model.safetensors',
        preview_url: 'https://p.example/preview.png'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'image',
      url: 'https://p.example/preview.png',
      alt: 'Display'
    })
  })

  it('3D extension without URL yields unsupported_type placeholder', () => {
    const p = resolveAssetPreviewPresentation(base({ name: 'mesh.glb' }), t)
    expect(p).toEqual({
      kind: 'placeholder',
      icon: expect.stringContaining('box'),
      alt: 'Display',
      reason: 'unsupported_type'
    })
  })

  it('uses name as alt when display_name missing', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'only.png',
        display_name: undefined,
        mime_type: 'image/png',
        preview_url: 'https://p.example/only.png'
      }),
      t
    )
    expect(p.kind).toBe('image')
    if (p.kind === 'image') {
      expect(p.alt).toBe('only.png')
    }
  })

  it('trims whitespace URLs as missing', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'x.png',
        mime_type: 'image/png',
        thumbnail_url: '   ',
        preview_url: ''
      }),
      t
    )
    expect(p).toEqual({
      kind: 'placeholder',
      icon: expect.stringContaining('lucide'),
      alt: 'Display',
      reason: 'missing_url'
    })
  })

  it('audio mime yields unsupported_type placeholder', () => {
    const p = resolveAssetPreviewPresentation(
      base({
        name: 'x.wav',
        mime_type: 'audio/wav'
      }),
      t
    )
    expect(p).toEqual({
      kind: 'placeholder',
      icon: expect.stringContaining('music'),
      alt: 'Display',
      reason: 'unsupported_type'
    })
  })

  it('uses translated fallback when display_name and name are nullish', () => {
    const spy = vi.fn((key: string) =>
      key === 'assets.fallbackAlt' ? 'LocalizedAsset' : key
    )
    const asset = {
      name: undefined,
      display_name: undefined,
      mime_type: 'image/png',
      thumbnail_url: undefined,
      preview_url: undefined
    } as unknown as AssetPreviewSource
    const p = resolveAssetPreviewPresentation(asset, spy)
    expect(spy).toHaveBeenCalledWith('assets.fallbackAlt')
    expect(p).toMatchObject({
      kind: 'placeholder',
      alt: 'LocalizedAsset',
      reason: 'missing_url'
    })
  })
})
