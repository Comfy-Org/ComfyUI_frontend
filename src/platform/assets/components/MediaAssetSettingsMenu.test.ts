import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import MediaAssetSettingsMenu from '@/platform/assets/components/MediaAssetSettingsMenu.vue'
import type { SortBy } from '@/platform/assets/components/MediaAssetSettingsMenu.vue'
import type { MediaAssetViewMode } from '@/platform/assets/components/mediaAssetViewOptions'

const KEYS = {
  list: 'sideToolbar.queueProgressOverlay.viewList',
  gridSmall: 'sideToolbar.mediaAssets.viewGridSmall',
  grid: 'sideToolbar.mediaAssets.viewGridLarge',
  newest: 'sideToolbar.mediaAssets.sortNewestFirst',
  oldest: 'sideToolbar.mediaAssets.sortOldestFirst',
  az: 'sideToolbar.mediaAssets.sortAToZ',
  za: 'sideToolbar.mediaAssets.sortZToA',
  longest: 'sideToolbar.mediaAssets.sortLongestFirst',
  fastest: 'sideToolbar.mediaAssets.sortFastestFirst'
} as const

interface MountOptions {
  viewMode?: MediaAssetViewMode
  sortBy?: SortBy
  showSortOptions?: boolean
  showGenerationTimeSort?: boolean
}

function mountWithModels(options: MountOptions = {}) {
  const viewMode = ref<MediaAssetViewMode>(options.viewMode ?? 'list')
  const sortBy = ref<SortBy>(options.sortBy ?? 'newest')

  const Host = defineComponent({
    components: { MediaAssetSettingsMenu },
    setup() {
      return {
        viewMode,
        sortBy,
        showSortOptions: options.showSortOptions ?? false,
        showGenerationTimeSort: options.showGenerationTimeSort ?? false
      }
    },
    template: `
      <MediaAssetSettingsMenu
        v-model:viewMode="viewMode"
        v-model:sortBy="sortBy"
        :showSortOptions="showSortOptions"
        :showGenerationTimeSort="showGenerationTimeSort"
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
      { label: KEYS.gridSmall, expected: 'grid-small' },
      { label: KEYS.grid, expected: 'grid' }
    ] as const)(
      'updates the v-model:viewMode to $expected when clicked',
      async ({ label, expected }) => {
        const { viewMode, user } = mountWithModels({ viewMode: 'list' })
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

    it('hides longest/fastest options unless showGenerationTimeSort is also true', () => {
      mountWithModels({
        showSortOptions: true,
        showGenerationTimeSort: false
      })
      expect(screen.queryByRole('button', { name: KEYS.longest })).toBeNull()
      expect(screen.queryByRole('button', { name: KEYS.fastest })).toBeNull()
    })

    it('shows generation-time options when both flags are true', () => {
      mountWithModels({
        showSortOptions: true,
        showGenerationTimeSort: true
      })
      expect(getButton(KEYS.longest)).toBeTruthy()
      expect(getButton(KEYS.fastest)).toBeTruthy()
    })
  })

  describe('v-model:sortBy round-trip', () => {
    const cases: Array<{ key: keyof typeof KEYS; expected: SortBy }> = [
      { key: 'newest', expected: 'newest' },
      { key: 'oldest', expected: 'oldest' },
      { key: 'az', expected: 'az' },
      { key: 'za', expected: 'za' },
      { key: 'longest', expected: 'longest' },
      { key: 'fastest', expected: 'fastest' }
    ]

    for (const { key, expected } of cases) {
      it(`emits ${expected} when ${key} is clicked`, async () => {
        const { sortBy, user } = mountWithModels({
          sortBy: 'newest',
          showSortOptions: true,
          showGenerationTimeSort: true
        })
        await user.click(getButton(KEYS[key]))
        expect(sortBy.value).toBe(expected)
      })
    }
  })
})
