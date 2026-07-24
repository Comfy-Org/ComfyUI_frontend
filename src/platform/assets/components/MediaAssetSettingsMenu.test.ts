import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import MediaAssetSettingsMenu from '@/platform/assets/components/MediaAssetSettingsMenu.vue'
import type { SortBy } from '@/platform/assets/components/MediaAssetSettingsMenu.vue'

const KEYS = {
  list: 'sideToolbar.queueProgressOverlay.viewList',
  grid: 'sideToolbar.queueProgressOverlay.viewGrid',
  newest: 'sideToolbar.mediaAssets.sortNewestFirst',
  oldest: 'sideToolbar.mediaAssets.sortOldestFirst',
  longest: 'sideToolbar.mediaAssets.sortLongestFirst',
  fastest: 'sideToolbar.mediaAssets.sortFastestFirst'
} as const

interface MountOptions {
  viewMode?: 'list' | 'grid'
  sortBy?: SortBy
  showSortOptions?: boolean
  showGenerationTimeSort?: boolean
}

function mountWithModels(options: MountOptions = {}) {
  const viewMode = ref<'list' | 'grid'>(options.viewMode ?? 'list')
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
    it('renders both list and grid view options', () => {
      mountWithModels()
      expect(getButton(KEYS.list)).toBeTruthy()
      expect(getButton(KEYS.grid)).toBeTruthy()
    })

    it('updates the v-model:viewMode when an option is clicked', async () => {
      const { viewMode, user } = mountWithModels({ viewMode: 'list' })
      await user.click(getButton(KEYS.grid))
      expect(viewMode.value).toBe('grid')
    })
  })

  describe('sort options (gated by showSortOptions)', () => {
    it('hides newest/oldest sort buttons when showSortOptions is false', () => {
      mountWithModels({ showSortOptions: false })
      expect(screen.queryByRole('button', { name: KEYS.newest })).toBeNull()
      expect(screen.queryByRole('button', { name: KEYS.oldest })).toBeNull()
    })

    it('shows newest and oldest options when showSortOptions is true', () => {
      mountWithModels({ showSortOptions: true })
      expect(getButton(KEYS.newest)).toBeTruthy()
      expect(getButton(KEYS.oldest)).toBeTruthy()
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
