import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import MediaAssetFilterMenu from '@/platform/assets/components/MediaAssetFilterMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

interface Overrides {
  mediaTypeFilters?: string[]
  dateFilter?: string
}

function renderMenu(overrides: Overrides = {}) {
  const onMedia = vi.fn()
  const onDate = vi.fn()
  const utils = render(MediaAssetFilterMenu, {
    props: {
      mediaTypeFilters: overrides.mediaTypeFilters ?? [],
      dateFilter: overrides.dateFilter ?? '',
      'onUpdate:mediaTypeFilters': onMedia,
      'onUpdate:dateFilter': onDate
    },
    global: { plugins: [i18n] }
  })
  return { ...utils, onMedia, onDate, user: userEvent.setup() }
}

const CAT = {
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

  it('shows Clear all and resets every facet when a filter is applied', async () => {
    const { onMedia, onDate, user } = renderMenu({
      mediaTypeFilters: ['image'],
      dateFilter: 'today'
    })
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Clear all' }))
    expect(onMedia).toHaveBeenCalledWith([])
    expect(onDate).toHaveBeenCalledWith('')
  })
})
