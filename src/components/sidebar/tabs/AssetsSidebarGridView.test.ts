import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { useElementSize } from '@vueuse/core'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MEDIA_ASSET_GRID_MODE } from '@/platform/assets/components/mediaAssetViewOptions'
import type { MediaAssetGridMode } from '@/platform/assets/components/mediaAssetViewOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { mockPagedList } from '@/utils/__tests__/pagedListUtils'

import AssetsSidebarGridView from './AssetsSidebarGridView.vue'

vi.mock(import('@vueuse/core'), { spy: true })

beforeEach(() => {
  vi.mocked(useElementSize).mockReturnValue({
    width: ref(400),
    height: ref(200),
    stop: vi.fn()
  })
})

const MediaAssetCardStub = defineComponent({
  name: 'MediaAssetCard',
  props: {
    showNativeVideoControls: {
      type: Boolean,
      default: true
    }
  },
  template:
    '<div data-testid="media-asset-card" :data-show-native-video-controls="showNativeVideoControls" />'
})

const videoAsset: AssetItem = fromPartial({
  id: 'video-asset',
  name: 'clip.mp4',
  tags: []
})

function renderGridView(gridMode: MediaAssetGridMode) {
  return render(AssetsSidebarGridView, {
    props: {
      assets: mockPagedList({ items: [videoAsset] }),
      isSelected: () => false,
      showOutputCount: () => false,
      getOutputCount: () => 0,
      gridMode
    },
    global: {
      stubs: {
        MediaAssetCard: MediaAssetCardStub
      }
    }
  })
}

describe('AssetsSidebarGridView', () => {
  it.for([
    {
      gridMode: MEDIA_ASSET_GRID_MODE.gridSmall,
      expectedNativeControls: false
    },
    {
      gridMode: MEDIA_ASSET_GRID_MODE.grid,
      expectedNativeControls: true
    }
  ])(
    'sets native video controls to $expectedNativeControls in $gridMode mode',
    ({ gridMode, expectedNativeControls }) => {
      renderGridView(gridMode)

      expect(screen.getByTestId('media-asset-card')).toHaveAttribute(
        'data-show-native-video-controls',
        String(expectedNativeControls)
      )
    }
  )
})
