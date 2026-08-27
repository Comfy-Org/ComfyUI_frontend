import { describe, expect, it, vi } from 'vitest'

import { assetToResultItem } from './assetResultItem'

vi.mock('@/stores/queueStore', () => ({
  ResultItemImpl: class {
    constructor(init: Record<string, unknown>) {
      Object.assign(this, init)
    }
  }
}))

describe('assetToResultItem', () => {
  it('uses asset URLs for standard and VHS previews', () => {
    const result = assetToResultItem({
      id: 'asset-1',
      name: 'preview.mp4',
      preview_url: 'https://example.com/preview.mp4',
      thumbnail_url: 'https://example.com/thumbnail.webp',
      size: 1,
      tags: ['output'],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    })

    expect(result.url).toBe('https://example.com/preview.mp4')
    expect(result.previewUrl).toBe('https://example.com/thumbnail.webp')
    expect(result.vhsAdvancedPreviewUrl).toBe('https://example.com/preview.mp4')
  })
})
