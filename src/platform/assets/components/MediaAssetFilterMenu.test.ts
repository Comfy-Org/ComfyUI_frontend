import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import MediaAssetFilterMenu from '@/platform/assets/components/MediaAssetFilterMenu.vue'
import type { VisibilityFilter } from '@/platform/assets/composables/useMediaAssetFiltering'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

interface Overrides {
  mediaTypeFilters?: string[]
  visibilityFilter?: VisibilityFilter
  authorFilter?: string
  dateFilter?: string
  authorOptions?: string[]
}

function renderMenu(overrides: Overrides = {}) {
  const onMedia = vi.fn()
  const onVisibility = vi.fn()
  const onAuthor = vi.fn()
  const onDate = vi.fn()
  const utils = render(MediaAssetFilterMenu, {
    props: {
      mediaTypeFilters: overrides.mediaTypeFilters ?? [],
      visibilityFilter: overrides.visibilityFilter ?? 'all',
      authorFilter: overrides.authorFilter ?? '',
      dateFilter: overrides.dateFilter ?? '',
      authorOptions: overrides.authorOptions ?? ['Me', 'Mei Chen'],
      'onUpdate:mediaTypeFilters': onMedia,
      'onUpdate:visibilityFilter': onVisibility,
      'onUpdate:authorFilter': onAuthor,
      'onUpdate:dateFilter': onDate
    },
    global: { plugins: [i18n] }
  })
  return {
    ...utils,
    onMedia,
    onVisibility,
    onAuthor,
    onDate,
    user: userEvent.setup()
  }
}

const CAT = {
  author: 'Created by',
  visibility: 'Visibility',
  media: 'Media type',
  date: 'Date'
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Filter by' }))
}

function categoryItem(label: string) {
  return screen.getByRole('menuitem', { name: new RegExp(label) })
}

describe('MediaAssetFilterMenu', () => {
  it('lists every filter category', async () => {
    const { user } = renderMenu()
    await openMenu(user)
    expect(categoryItem(CAT.author)).toBeTruthy()
    expect(categoryItem(CAT.visibility)).toBeTruthy()
    expect(categoryItem(CAT.media)).toBeTruthy()
    expect(categoryItem(CAT.date)).toBeTruthy()
  })

  it('surfaces a matching value via flat search and applies it', async () => {
    const { onMedia, user } = renderMenu()
    await openMenu(user)
    await user.type(screen.getByRole('textbox'), 'video')

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Video' }))
    expect(onMedia).toHaveBeenCalledWith(['video'])
  })

  it('applies a date preset via flat search', async () => {
    const { onDate, user } = renderMenu()
    await openMenu(user)
    await user.type(screen.getByRole('textbox'), 'today')

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Today' }))
    expect(onDate).toHaveBeenCalledWith('today')
  })

  it('toggles a date preset off when it is already applied', async () => {
    const { onDate, user } = renderMenu({ dateFilter: 'today' })
    await openMenu(user)
    await user.type(screen.getByRole('textbox'), 'today')

    const row = screen.getByRole('menuitemcheckbox', { name: 'Today' })
    expect(row).toHaveAttribute('aria-checked', 'true')

    await user.click(row)
    expect(onDate).toHaveBeenCalledWith('')
  })

  it('moves focus into the results with arrow keys after searching', async () => {
    const { user } = renderMenu()
    await openMenu(user)
    await user.type(screen.getByRole('textbox'), 'a')

    const results = screen.getAllByRole('menuitemcheckbox')
    await user.keyboard('{ArrowDown}')
    expect(results[0]).toHaveFocus()

    screen.getByRole('textbox').focus()
    await user.keyboard('{ArrowUp}')
    expect(results[results.length - 1]).toHaveFocus()
  })

  it('toggles a media value off when it is already applied', async () => {
    const { onMedia, user } = renderMenu({ mediaTypeFilters: ['video'] })
    await openMenu(user)
    await user.type(screen.getByRole('textbox'), 'video')

    const row = screen.getByRole('menuitemcheckbox', { name: 'Video' })
    expect(row).toHaveAttribute('aria-checked', 'true')

    await user.click(row)
    expect(onMedia).toHaveBeenCalledWith([])
  })

  it('clears a single-select facet when its active value is picked again', async () => {
    const { onVisibility, user } = renderMenu({ visibilityFilter: 'shared' })
    await openMenu(user)
    await user.type(screen.getByRole('textbox'), 'shared')

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Shared' }))
    expect(onVisibility).toHaveBeenCalledWith('all')
  })

  it('shows Clear all and resets every facet when a filter is applied', async () => {
    const { onMedia, onVisibility, onAuthor, onDate, user } = renderMenu({
      mediaTypeFilters: ['image'],
      visibilityFilter: 'shared',
      authorFilter: 'Me',
      dateFilter: 'today'
    })
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Clear all' }))
    expect(onMedia).toHaveBeenCalledWith([])
    expect(onVisibility).toHaveBeenCalledWith('all')
    expect(onAuthor).toHaveBeenCalledWith('')
    expect(onDate).toHaveBeenCalledWith('')
  })

  describe('Created by submenu search', () => {
    const TEAM = ['Me', 'Mei Chen', 'Jordan Lee', 'Priya Nair']

    async function openAuthorSubmenu(user: ReturnType<typeof userEvent.setup>) {
      await openMenu(user)
      await user.click(categoryItem(CAT.author))
      return screen.getByPlaceholderText('Search people...')
    }

    it('narrows only the people list and applies a match', async () => {
      const { onAuthor, user } = renderMenu({ authorOptions: TEAM })
      const search = await openAuthorSubmenu(user)

      search.focus()
      await user.keyboard('jordan')

      expect(
        screen.getByRole('menuitemcheckbox', { name: 'Jordan Lee' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('menuitemcheckbox', { name: 'Mei Chen' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('menuitemcheckbox', { name: 'Everyone' })
      ).not.toBeInTheDocument()
      expect(categoryItem(CAT.media)).toBeTruthy()

      await user.keyboard('{ArrowDown}')
      expect(
        screen.getByRole('menuitemcheckbox', { name: 'Jordan Lee' })
      ).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(onAuthor).toHaveBeenCalledWith('Jordan Lee')
    })

    it('shows a no-matches note for an unknown name', async () => {
      const { user } = renderMenu({ authorOptions: TEAM })
      const search = await openAuthorSubmenu(user)

      search.focus()
      await user.keyboard('zzz')

      expect(screen.queryAllByRole('menuitemcheckbox')).toHaveLength(0)
      expect(screen.getByText('No matches')).toBeInTheDocument()
    })
  })
})
