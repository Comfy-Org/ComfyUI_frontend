import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import MediaAssetSettingsMenu from '@/platform/assets/components/MediaAssetSettingsMenu.vue'
import type { SortBy } from '@/platform/assets/components/MediaAssetSettingsMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const KEYS = {
  list: 'List view',
  gridSmall: 'Grid (small)',
  gridLarge: 'Grid (large)',
  newest: 'Newest first',
  oldest: 'Oldest first',
  longest: 'Generation time (longest first)',
  fastest: 'Generation time (fastest first)',
  az: 'Name (A → Z)',
  za: 'Name (Z → A)'
} as const

type ViewMode = 'list' | 'grid-small' | 'grid-large'

interface MountOptions {
  viewMode?: ViewMode
  sortBy?: SortBy
  showSortOptions?: boolean
  showGenerationTimeSort?: boolean
}

function mountWithModels(options: MountOptions = {}) {
  const viewMode = ref<ViewMode>(options.viewMode ?? 'list')
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
      plugins: [i18n]
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
      expect(getButton(KEYS.gridLarge)).toBeTruthy()
    })

    it('updates the v-model:viewMode when an option is clicked', async () => {
      const { viewMode, user } = mountWithModels({ viewMode: 'list' })
      await user.click(getButton(KEYS.gridLarge))
      expect(viewMode.value).toBe('grid-large')
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
      { key: 'fastest', expected: 'fastest' },
      { key: 'az', expected: 'az' },
      { key: 'za', expected: 'za' }
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
