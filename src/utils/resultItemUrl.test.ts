import { describe, expect, it } from 'vitest'

import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemPreviewUrl } from '@/utils/resultItemUrl'

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

describe('resultItemPreviewUrl', () => {
  it('keeps the original URL and its revision when requesting full resolution', () => {
    const item = resultItem({
      url: '/api/view?filename=out.png&type=output&rand=second',
      previewUrl:
        '/api/view?filename=out.png&type=output&preview=webp;75&rand=second'
    })
    expect(resultItemPreviewUrl(item, { fullRes: true })).toBe(item.url)
    expect(resultItemPreviewUrl(item)).toBe(item.previewUrl)
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
    { filename: 'render.png', preview_id: 'p1', pathname: '/api/view' },
    {
      filename: 'render.mov',
      preview_id: 'p1',
      pathname: '/api/assets/p1/content'
    },
    { filename: 'render.mov', preview_id: undefined, pathname: '/api/view' }
  ])(
    'resolves $filename with preview_id $preview_id to $pathname',
    ({ filename, preview_id, pathname }) => {
      const url = new URL(
        resultItemPreviewUrl(resultItem({ filename, preview_id })),
        window.location.origin
      )
      expect(url.pathname).toBe(pathname)
    }
  )

  it('resolves no preview for an HDR output without a stored preview', () => {
    expect(resultItemPreviewUrl(resultItem({ filename: 'render.exr' }))).toBe(
      ''
    )
  })
})
