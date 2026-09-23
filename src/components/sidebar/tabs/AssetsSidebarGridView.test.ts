import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { MEDIA_ASSET_GRID_MODE } from '@/platform/assets/components/mediaAssetViewOptions'
import type { MediaAssetGridMode } from '@/platform/assets/components/mediaAssetViewOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import AssetsSidebarGridView from './AssetsSidebarGridView.vue'

const VirtualGridStub = defineComponent({
  name: 'VirtualGrid',
  props: {
    items: {
      type: Array,
      default: () => []
    }
  },
  template:
    '<div><slot v-for="item in items" :key="item.key" name="item" :item="item" /></div>'
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
      assets: [videoAsset],
      isSelected: () => false,
      showOutputCount: () => false,
      getOutputCount: () => 0,
      gridMode
    },
    global: {
      stubs: {
        VirtualGrid: VirtualGridStub,
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
