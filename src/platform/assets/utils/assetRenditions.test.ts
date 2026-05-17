import { describe, expect, it, vi } from 'vitest'

import {
  canRenderNatively,
  renditionFor
} from '@/platform/assets/utils/assetRenditions'

vi.mock('@/platform/assets/utils/assetUrlUtil', () => ({
  getAssetUrl: vi.fn(
    (asset: { name: string }) => `/api/view?filename=${asset.name}&type=output`
  )
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((route: string) =>
      route.startsWith('/api')
        ? `http://host${route}`
        : `http://host/api${route}`
    )
  }
}))

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asset-1',
    name: 'image.png',
    tags: ['output'],
    ...overrides
  } as never
}

describe('canRenderNatively', () => {
  it('accepts common browser-native image types', () => {
    expect(canRenderNatively('image/png')).toBe(true)
    expect(canRenderNatively('image/jpeg')).toBe(true)
    expect(canRenderNatively('image/webp')).toBe(true)
    expect(canRenderNatively('image/avif')).toBe(true)
    expect(canRenderNatively('image/gif')).toBe(true)
    expect(canRenderNatively('image/svg+xml')).toBe(true)
  })

  it('accepts browser-native video and audio types', () => {
    expect(canRenderNatively('video/mp4')).toBe(true)
    expect(canRenderNatively('video/webm')).toBe(true)
    expect(canRenderNatively('audio/mpeg')).toBe(true)
    expect(canRenderNatively('audio/wav')).toBe(true)
  })

  it('rejects non-browser-renderable image families (EXR, HDR, RAW, TIFF)', () => {
    expect(canRenderNatively('image/aces')).toBe(false)
    expect(canRenderNatively('image/x-exr')).toBe(false)
    expect(canRenderNatively('image/x-hdr')).toBe(false)
    expect(canRenderNatively('image/x-adobe-dng')).toBe(false)
    expect(canRenderNatively('image/tiff')).toBe(false)
  })

  it('rejects opaque file types (latents, models, text)', () => {
    expect(canRenderNatively('application/octet-stream')).toBe(false)
    expect(canRenderNatively('model/gltf-binary')).toBe(false)
    expect(canRenderNatively('text/plain')).toBe(false)
  })

  it('handles charset / parameter suffixes', () => {
    expect(canRenderNatively('image/png; charset=utf-8')).toBe(true)
    expect(canRenderNatively('IMAGE/PNG')).toBe(true)
  })

  it('returns false for null, undefined, and empty string', () => {
    expect(canRenderNatively(null)).toBe(false)
    expect(canRenderNatively(undefined)).toBe(false)
    expect(canRenderNatively('')).toBe(false)
  })
})

describe('renditionFor', () => {
  describe('grid surface', () => {
    it('prefers thumbnail_url when present', () => {
      const asset = makeAsset({
        mime_type: 'image/png',
        thumbnail_url: '/thumb.png',
        preview_url: '/preview.png'
      })
      expect(renditionFor(asset, 'grid')).toBe('http://host/api/thumb.png')
    })

    it('falls back to preview_url when no thumbnail_url', () => {
      const asset = makeAsset({
        mime_type: 'image/png',
        preview_url: '/preview.png'
      })
      expect(renditionFor(asset, 'grid')).toBe('http://host/api/preview.png')
    })

    it('falls back to canonical URL when renderable and no rendition exists', () => {
      const asset = makeAsset({ mime_type: 'image/png' })
      expect(renditionFor(asset, 'grid')).toBe(
        '/api/view?filename=image.png&type=output'
      )
    })

    it('returns null when not renderable and no rendition exists (EXR case)', () => {
      const asset = makeAsset({ name: 'render.exr', mime_type: 'image/aces' })
      expect(renditionFor(asset, 'grid')).toBeNull()
    })

    it('uses rendition for EXR when backend provides a transcoded preview', () => {
      const asset = makeAsset({
        name: 'render.exr',
        mime_type: 'image/aces',
        thumbnail_url: '/render.avif',
        preview_url: '/render.avif'
      })
      expect(renditionFor(asset, 'grid')).toBe('http://host/api/render.avif')
    })

    it('returns null for opaque types with no preview (latent, safetensors)', () => {
      const asset = makeAsset({
        name: 'weights.safetensors',
        mime_type: 'application/octet-stream'
      })
      expect(renditionFor(asset, 'grid')).toBeNull()
    })
  })

  describe('lightbox surface', () => {
    it('skips thumbnail_url and prefers preview_url', () => {
      const asset = makeAsset({
        mime_type: 'image/png',
        thumbnail_url: '/thumb.png',
        preview_url: '/full.png'
      })
      expect(renditionFor(asset, 'lightbox')).toBe('http://host/api/full.png')
    })

    it('falls back to canonical URL when renderable and no preview', () => {
      const asset = makeAsset({ mime_type: 'image/png' })
      expect(renditionFor(asset, 'lightbox')).toBe(
        '/api/view?filename=image.png&type=output'
      )
    })

    it('returns the AVIF rendition for an EXR', () => {
      const asset = makeAsset({
        name: 'render.exr',
        mime_type: 'image/aces',
        preview_url: '/render.avif'
      })
      expect(renditionFor(asset, 'lightbox')).toBe(
        'http://host/api/render.avif'
      )
    })

    it('returns null when not renderable and no preview exists', () => {
      const asset = makeAsset({ name: 'render.exr', mime_type: 'image/aces' })
      expect(renditionFor(asset, 'lightbox')).toBeNull()
    })
  })

  describe('newTab surface', () => {
    it('mirrors lightbox behaviour', () => {
      const asset = makeAsset({
        name: 'render.exr',
        mime_type: 'image/aces',
        preview_url: '/render.avif'
      })
      expect(renditionFor(asset, 'newTab')).toBe('http://host/api/render.avif')
    })
  })

  describe('download surface', () => {
    it('always returns the canonical URL, even when a preview exists', () => {
      const asset = makeAsset({
        name: 'render.exr',
        mime_type: 'image/aces',
        thumbnail_url: '/render.avif',
        preview_url: '/render.avif'
      })
      expect(renditionFor(asset, 'download')).toBe(
        '/api/view?filename=render.exr&type=output'
      )
    })

    it('returns the canonical URL for browser-native assets too', () => {
      const asset = makeAsset({
        mime_type: 'image/png',
        thumbnail_url: '/thumb.png'
      })
      expect(renditionFor(asset, 'download')).toBe(
        '/api/view?filename=image.png&type=output'
      )
    })
  })

  describe('URL normalization', () => {
    it('passes server-relative rendition URLs through api.apiURL', () => {
      const asset = makeAsset({
        mime_type: 'image/aces',
        thumbnail_url: '/assets/abc-123/content'
      })
      expect(renditionFor(asset, 'grid')).toBe(
        'http://host/api/assets/abc-123/content'
      )
    })

    it('does not double-prefix URLs that already start with /api', () => {
      const asset = makeAsset({
        mime_type: 'image/png',
        thumbnail_url: '/api/view?filename=already.png'
      })
      expect(renditionFor(asset, 'grid')).toBe(
        'http://host/api/view?filename=already.png'
      )
    })

    it('passes absolute http(s) URLs through untouched', () => {
      const asset = makeAsset({
        mime_type: 'image/png',
        thumbnail_url: 'https://cdn.example.com/thumb.png'
      })
      expect(renditionFor(asset, 'grid')).toBe(
        'https://cdn.example.com/thumb.png'
      )
    })

    it('passes blob and data URLs through untouched', () => {
      const blobAsset = makeAsset({
        mime_type: 'image/png',
        thumbnail_url: 'blob:http://host/abc-123'
      })
      expect(renditionFor(blobAsset, 'grid')).toBe('blob:http://host/abc-123')

      const dataAsset = makeAsset({
        mime_type: 'image/png',
        thumbnail_url: 'data:image/png;base64,iVBORw0KG'
      })
      expect(renditionFor(dataAsset, 'grid')).toBe(
        'data:image/png;base64,iVBORw0KG'
      )
    })
  })
})
