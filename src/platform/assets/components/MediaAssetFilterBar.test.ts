import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import MediaAssetFilterBar from '@/platform/assets/components/MediaAssetFilterBar.vue'
import type { MediaAssetDateFilter } from '@/platform/assets/mediaAssetFilterOptions'

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

interface FilterState {
  mediaTypeFilters?: string[]
  dateFilter?: MediaAssetDateFilter
}

function renderFilterBar({
  mediaTypeFilters = [],
  dateFilter = ''
}: FilterState = {}) {
  const TestHost = defineComponent({
    components: { MediaAssetFilterBar },
    setup() {
      return {
        searchQuery: ref(''),
        sortBy: ref('newest'),
        viewMode: ref('grid'),
        dateFilter: ref(dateFilter),
        mediaTypeFilters: ref(mediaTypeFilters)
      }
    },
    template: `
      <MediaAssetFilterBar
        v-model:search-query="searchQuery"
        v-model:sort-by="sortBy"
        v-model:view-mode="viewMode"
        v-model:date-filter="dateFilter"
        v-model:media-type-filters="mediaTypeFilters"
      />
    `
  })

  return {
    ...render(TestHost, {
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    }),
    user: userEvent.setup()
  }
}

describe('MediaAssetFilterBar', () => {
  it('switches directly from filters to view settings', async () => {
    const { user } = renderFilterBar()
    const filterButton = screen.getByRole('button', { name: 'Filter by' })
    const settingsButton = screen.getByRole('button', {
      name: 'View settings'
    })

    await user.click(filterButton)
    expect(filterButton).toHaveAttribute('aria-expanded', 'true')

    await user.click(settingsButton)

    expect(filterButton).toHaveAttribute('aria-expanded', 'false')
    expect(settingsButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('List view')).toBeVisible()
  })

  it('does not show applied-filter controls when no filters are active', () => {
    renderFilterBar()

    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull()
    expect(screen.queryByTestId('active-filter-indicator')).toBeNull()
  })

  it('shows each applied filter and the active indicator', () => {
    renderFilterBar({
      mediaTypeFilters: ['image', 'video'],
      dateFilter: 'week'
    })

    expect(
      screen.getByRole('button', { name: 'Remove Image filter' })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Remove Video filter' })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Remove Past 7 days filter' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeVisible()
    expect(screen.getByTestId('active-filter-indicator')).toBeVisible()
  })

  it('removes one media or date filter without changing the others', async () => {
    const { user } = renderFilterBar({
      mediaTypeFilters: ['image', 'video'],
      dateFilter: 'week'
    })

    await user.click(
      screen.getByRole('button', { name: 'Remove Image filter' })
    )

    expect(
      screen.queryByRole('button', { name: 'Remove Image filter' })
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Remove Video filter' })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Remove Past 7 days filter' })
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'Remove Past 7 days filter' })
    )

    expect(
      screen.queryByRole('button', { name: 'Remove Past 7 days filter' })
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Remove Video filter' })
    ).toBeVisible()
  })

  it('clears every applied filter', async () => {
    const { user } = renderFilterBar({
      mediaTypeFilters: ['image'],
      dateFilter: 'today'
    })

    await user.click(screen.getByRole('button', { name: 'Clear all' }))

    expect(
      screen.queryByRole('button', { name: 'Remove Image filter' })
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Remove Today filter' })
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull()
    expect(screen.queryByTestId('active-filter-indicator')).toBeNull()
  })
})
