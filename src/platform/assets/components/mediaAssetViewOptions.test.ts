import { describe, expect, it } from 'vitest'

import { getMediaAssetGridColumns } from '@/platform/assets/components/mediaAssetViewOptions'
import type { MediaAssetGridMode } from '@/platform/assets/components/mediaAssetViewOptions'

describe('getMediaAssetGridColumns', () => {
  it.for([
    { mode: 'grid-small', minWidth: 128 },
    { mode: 'grid', minWidth: 240 }
  ] satisfies Array<{ mode: MediaAssetGridMode; minWidth: number }>)(
    'uses a $minWidth px minimum width for $mode',
    ({ mode, minWidth }) => {
      expect(getMediaAssetGridColumns(mode)).toBe(
        `repeat(auto-fill, minmax(min(${minWidth}px, 30vw), 1fr))`
      )
    }
  )
})
