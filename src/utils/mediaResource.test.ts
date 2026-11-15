import { describe, expect, it, vi } from 'vitest'

import type { AugmentedResultItem } from '@/utils/resultItem'
import { resolveMediaSources, resultItemUrl } from '@/utils/mediaResource'

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

function resultItem(
  overrides: Partial<AugmentedResultItem>
): AugmentedResultItem {
  return {
    filename: 'out.png',
    subfolder: '',
    type: 'output',
    nodeId: '3',
    mediaType: 'images',
    ...overrides
  }
}

describe('resolveMediaSources', () => {
  it.for([
    {
      filename: 'image.png',
      previewFormat: '',
      preview: 'webp;75',
      res: '512'
    },
    {
      filename: 'image.png',
      previewFormat: '&preview=jpeg;50',
      preview: 'jpeg;50',
      res: '512'
    },
    { filename: 'diagram.svg', previewFormat: '', preview: null, res: null }
  ])(
    'resolves a browser thumbnail for $filename with $previewFormat',
    ({ filename, previewFormat, preview, res }) => {
      const media = resolveMediaSources(resultItem({ filename }), {
        previewFormat
      })
      const thumbnail = new URL(media.thumbnailUrl, window.location.origin)
      expect(thumbnail.searchParams.get('preview')).toBe(preview)
      expect(thumbnail.searchParams.get('res')).toBe(res)
      expect(media.displayUrl).toBe(media.originalUrl)
      expect(media.originalUrl).not.toContain('preview=')
    }
  )

  it.for([
    'blob:original',
    'https://cdn.test/view?signature=opaque',
    '/api/view?filename=out.png&type=output&signature=opaque',
    ''
  ])('preserves the supplied source %s without rewriting it', (url) => {
    const media = resolveMediaSources(resultItem({ url }), {
      previewFormat: '&preview=webp;75',
      rand: '&rand=new'
    })
    expect([
      media.originalUrl,
      media.displayUrl,
      media.previewUrl,
      media.thumbnailUrl
    ]).toEqual([url, url, url, url])
  })

  it('distinguishes an unpreviewable original from a missing file', () => {
    const media = resolveMediaSources(
      resultItem({ filename: 'render.exr', url: 'blob:original' })
    )
    expect(media).toEqual({
      originalUrl: 'blob:original',
      displayUrl: '',
      previewUrl: '',
      thumbnailUrl: '',
      canEditPixels: false
    })
  })

  it('resizes previews without resizing originals', () => {
    const item = resultItem({})
    const viewParams = new URLSearchParams({
      filename: 'out.png',
      type: 'output',
      channel: 'alpha'
    })

    const preview = new URL(
      resolveMediaSources(item, { viewParams }).previewUrl,
      window.location.origin
    )
    const original = new URL(
      resultItemUrl(item, viewParams),
      window.location.origin
    )

    expect(preview.searchParams.get('res')).toBe('512')
    expect(preview.searchParams.get('channel')).toBe('alpha')
    expect(original.searchParams.has('res')).toBe(false)
  })

  it('keeps the original URL and its revision when requesting full resolution', () => {
    const item = resultItem({
      url: '/api/view?filename=out.png&type=output&rand=second',
      previewUrl:
        '/api/view?filename=out.png&type=output&preview=webp;75&rand=second'
    })
    expect(resolveMediaSources(item).displayUrl).toBe(item.url)
    expect(
      resolveMediaSources(item, {
        previewFormat: '&preview=webp;75',
        rand: '&rand=ignored'
      }).previewUrl
    ).toBe(item.previewUrl)
  })

  it('applies preview format and output revision to generated URLs', () => {
    const url = new URL(
      resolveMediaSources(resultItem({ filename: 'out.png' }), {
        previewFormat: '&preview=webp;75',
        rand: '&rand=revision-2'
      }).previewUrl,
      window.location.origin
    )

    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      filename: 'out.png',
      type: 'output',
      subfolder: '',
      preview: 'webp;75',
      rand: 'revision-2'
    })
  })

  it.for([
    {
      filename: 'render.exr',
      preview_id: 'p1',
      pathname: '/api/assets/p1/content'
    },
    {
      filename: 'render.HDR',
      preview_id: 'p1',
      pathname: '/api/assets/p1/content'
    },
    { filename: 'render.png', preview_id: 'p1', pathname: '/api/view' }
  ])(
    'resolves $filename with preview_id $preview_id to $pathname',
    ({ filename, preview_id, pathname }) => {
      const url = new URL(
        resolveMediaSources(resultItem({ filename, preview_id })).previewUrl,
        window.location.origin
      )
      expect(url.pathname).toBe(pathname)
    }
  )

  it('resolves no preview for an HDR output without a stored preview', () => {
    expect(
      resolveMediaSources(resultItem({ filename: 'render.exr' }), {
        previewFormat: '&preview=webp;75',
        rand: '&rand=ignored'
      }).previewUrl
    ).toBe('')
  })
})
