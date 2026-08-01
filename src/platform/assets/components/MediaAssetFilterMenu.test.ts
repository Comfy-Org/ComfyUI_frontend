import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import MediaAssetFilterButton from '@/platform/assets/components/MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from '@/platform/assets/components/MediaAssetFilterMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

interface FilterState {
  mediaTypeFilters?: string[]
  dateFilter?: string
}

function renderMenu({
  mediaTypeFilters = [],
  dateFilter = ''
}: FilterState = {}) {
  const onMediaTypeUpdate = vi.fn()
  const onDateUpdate = vi.fn()
  const TestHost = defineComponent({
    components: { MediaAssetFilterButton, MediaAssetFilterMenu },
    setup: () => ({
      dateFilter,
      mediaTypeFilters,
      onDateUpdate,
      onMediaTypeUpdate
    }),
    template: `
      <MediaAssetFilterButton>
        <MediaAssetFilterMenu
          :media-type-filters="mediaTypeFilters"
          :date-filter="dateFilter"
          @update:media-type-filters="onMediaTypeUpdate"
          @update:date-filter="onDateUpdate"
        />
      </MediaAssetFilterButton>
    `
  })

  const utils = render(TestHost, {
    global: { plugins: [i18n] }
  })
  return {
    ...utils,
    onDateUpdate,
    onMediaTypeUpdate,
    user: userEvent.setup()
  }
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Filter by' }))
}

async function openMediaTypeMenu(user: ReturnType<typeof userEvent.setup>) {
  await openMenu(user)
  await user.click(screen.getByRole('menuitem', { name: /Media type/ }))
}

async function openDateMenu(user: ReturnType<typeof userEvent.setup>) {
  await openMenu(user)
  await user.click(screen.getByRole('menuitem', { name: /^Date$/ }))
}

const mediaTypeLabels = ['Image', 'Video', 'Audio', '3D', 'Text']
const dateLabels = [
  'All time',
  'Today',
  'Past 7 days',
  'Past 30 days',
  'This year'
]

describe('MediaAssetFilterMenu', () => {
  it('groups media type and date under the Attribute section', async () => {
    const { user } = renderMenu()
    await openMenu(user)

    expect(screen.getByText('Attribute')).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /Media type/ })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /^Date$/ })).toBeVisible()
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Image' })).toBeNull()
  })

  it('shows every media type in the nested menu', async () => {
    const { user } = renderMenu()
    await openMediaTypeMenu(user)

    for (const label of mediaTypeLabels) {
      expect(
        screen.getByRole('menuitemcheckbox', { name: label })
      ).toBeVisible()
    }
  })

  it('reflects the selected media types', async () => {
    const { user } = renderMenu({ mediaTypeFilters: ['image', '3d'] })
    await openMediaTypeMenu(user)

    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Image' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('menuitemcheckbox', { name: '3D' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Video' })
    ).toHaveAttribute('aria-checked', 'false')
  })

  it('adds a media type with the keyboard without closing either menu', async () => {
    const { onMediaTypeUpdate, user } = renderMenu({
      mediaTypeFilters: ['image']
    })
    await openMediaTypeMenu(user)

    screen.getByRole('menuitemcheckbox', { name: 'Video' }).focus()
    await user.keyboard('{Enter}')

    expect(onMediaTypeUpdate).toHaveBeenCalledWith(['image', 'video'])
    expect(screen.getByRole('menu', { name: 'Filter by' })).toBeVisible()
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Video' })
    ).toBeVisible()
  })

  it('removes an already selected media type', async () => {
    const { onMediaTypeUpdate, user } = renderMenu({
      mediaTypeFilters: ['image', 'audio']
    })
    await openMediaTypeMenu(user)

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Audio' }))

    expect(onMediaTypeUpdate).toHaveBeenCalledWith(['image'])
  })

  it('shows every date option in the nested menu', async () => {
    const { user } = renderMenu()
    await openDateMenu(user)

    for (const label of dateLabels) {
      expect(screen.getByRole('menuitemradio', { name: label })).toBeVisible()
    }
  })

  it('reflects the selected date', async () => {
    const { user } = renderMenu({ dateFilter: 'week' })
    await openDateMenu(user)

    expect(
      screen.getByRole('menuitemradio', { name: 'Past 7 days' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('menuitemradio', { name: 'Today' })
    ).toHaveAttribute('aria-checked', 'false')
  })

  it('selects a date with the keyboard without closing the filter dropdown', async () => {
    const { onDateUpdate, user } = renderMenu()
    await openDateMenu(user)

    screen.getByRole('menuitemradio', { name: 'Today' }).focus()
    await user.keyboard('{Enter}')

    expect(onDateUpdate).toHaveBeenCalledWith('today')
    expect(screen.getByRole('menu', { name: 'Filter by' })).toBeVisible()
  })

  it('clears the date with All time', async () => {
    const { onDateUpdate, user } = renderMenu({ dateFilter: 'month' })
    await openDateMenu(user)

    await user.click(screen.getByRole('menuitemradio', { name: 'All time' }))

    expect(onDateUpdate).toHaveBeenCalledWith('')
  })
})
