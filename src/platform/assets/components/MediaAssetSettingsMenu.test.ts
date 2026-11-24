import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import MediaAssetSettingsMenu from '@/platform/assets/components/MediaAssetSettingsMenu.vue'
import { MEDIA_ASSET_VIEW_MODE } from '@/platform/assets/components/mediaAssetViewOptions'
import type { MediaAssetViewMode } from '@/platform/assets/components/mediaAssetViewOptions'
import { DEFAULT_MEDIA_ASSET_SORT } from '@/platform/assets/mediaAssetSortOptions'
import type { MediaAssetSort } from '@/platform/assets/mediaAssetSortOptions'

const KEYS = {
  list: 'sideToolbar.queueProgressOverlay.viewList',
  gridSmall: 'sideToolbar.mediaAssets.viewGridSmall',
  grid: 'sideToolbar.mediaAssets.viewGridLarge',
  newest: 'sideToolbar.mediaAssets.sortNewestFirst',
  oldest: 'sideToolbar.mediaAssets.sortOldestFirst',
  az: 'sideToolbar.mediaAssets.sortAToZ',
  za: 'sideToolbar.mediaAssets.sortZToA'
} as const

interface MountOptions {
  viewMode?: MediaAssetViewMode
  sortBy?: MediaAssetSort
  showSortOptions?: boolean
}

function mountWithModels(options: MountOptions = {}) {
  const viewMode = ref<MediaAssetViewMode>(
    options.viewMode ?? MEDIA_ASSET_VIEW_MODE.list
  )
  const sortBy = ref<MediaAssetSort>(options.sortBy ?? DEFAULT_MEDIA_ASSET_SORT)

  const Host = defineComponent({
    components: { MediaAssetSettingsMenu },
    setup() {
      return {
        viewMode,
        sortBy,
        showSortOptions: options.showSortOptions ?? false
      }
    },
    template: `
      <MediaAssetSettingsMenu
        v-model:viewMode="viewMode"
        v-model:sortBy="sortBy"
        :showSortOptions="showSortOptions"
      />
    `
  })

  const utils = render(Host, {
    global: {
      mocks: {
        $t: (key: string) => key
      }
    }
  })
  return { ...utils, viewMode, sortBy, user: userEvent.setup() }
}

function getButton(label: string): HTMLElement {
  return screen.getByRole('button', { name: label })
}

describe('MediaAssetSettingsMenu', () => {
  describe('view-mode options (always visible)', () => {
    it('renders list and both grid view options', () => {
      mountWithModels()
      expect(getButton(KEYS.list)).toBeTruthy()
      expect(getButton(KEYS.gridSmall)).toBeTruthy()
      expect(getButton(KEYS.grid)).toBeTruthy()
    })

    it.for([
      {
        label: KEYS.gridSmall,
        expected: MEDIA_ASSET_VIEW_MODE.gridSmall
      },
      { label: KEYS.grid, expected: MEDIA_ASSET_VIEW_MODE.grid }
    ] as const)(
      'updates the v-model:viewMode to $expected when clicked',
      async ({ label, expected }) => {
        const { viewMode, user } = mountWithModels({
          viewMode: MEDIA_ASSET_VIEW_MODE.list
        })
        await user.click(getButton(label))
        expect(viewMode.value).toBe(expected)
      }
    )
  })

  describe('sort options (gated by showSortOptions)', () => {
    it('hides newest/oldest sort buttons when showSortOptions is false', () => {
      mountWithModels({ showSortOptions: false })
      expect(screen.queryByRole('button', { name: KEYS.newest })).toBeNull()
      expect(screen.queryByRole('button', { name: KEYS.oldest })).toBeNull()
    })

    it('shows date and name sort options when showSortOptions is true', () => {
      mountWithModels({ showSortOptions: true })
      expect(getButton(KEYS.newest)).toBeTruthy()
      expect(getButton(KEYS.oldest)).toBeTruthy()
      expect(getButton(KEYS.az)).toBeTruthy()
      expect(getButton(KEYS.za)).toBeTruthy()
    })
  })

  describe('v-model:sortBy round-trip', () => {
    it.for([
      { key: 'newest', expected: { sort: 'created_at', order: 'desc' } },
      { key: 'oldest', expected: { sort: 'created_at', order: 'asc' } },
      { key: 'az', expected: { sort: 'name', order: 'asc' } },
      { key: 'za', expected: { sort: 'name', order: 'desc' } }
    ] as const)(
      'emits $expected.sort $expected.order when $key is clicked',
      async ({ key, expected }) => {
        const { sortBy, user } = mountWithModels({
          sortBy: { sort: 'size', order: 'asc' },
          showSortOptions: true
        })
        await user.click(getButton(KEYS[key]))
        expect(sortBy.value).toEqual(expected)
      }
    )
  })
})
