import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import MediaAssetFilterMenu from '@/platform/assets/components/MediaAssetFilterMenu.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

function renderMenu(mediaTypeFilters: string[] = []) {
  const onUpdate = vi.fn()
  const utils = render(MediaAssetFilterMenu, {
    props: {
      mediaTypeFilters,
      'onUpdate:mediaTypeFilters': onUpdate
    },
    global: {
      mocks: {
        $t: (key: string) => key
      }
    }
  })
  return { ...utils, onUpdate, user: userEvent.setup() }
}

const labelByType: Record<string, string> = {
  image: 'sideToolbar.mediaAssets.filterImage',
  video: 'sideToolbar.mediaAssets.filterVideo',
  audio: 'sideToolbar.mediaAssets.filterAudio',
  '3d': 'sideToolbar.mediaAssets.filter3D'
}

function getCheckbox(type: keyof typeof labelByType): HTMLElement {
  return screen.getByRole('checkbox', { name: labelByType[type] })
}

describe('MediaAssetFilterMenu', () => {
  it('renders all four media-type checkboxes', () => {
    renderMenu()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(4)
    for (const type of Object.keys(labelByType)) {
      expect(getCheckbox(type)).toBeTruthy()
    }
  })

  it('reflects checked state from the prop via aria-checked', () => {
    renderMenu(['image', '3d'])

    expect(getCheckbox('image').getAttribute('aria-checked')).toBe('true')
    expect(getCheckbox('3d').getAttribute('aria-checked')).toBe('true')
    expect(getCheckbox('video').getAttribute('aria-checked')).toBe('false')
    expect(getCheckbox('audio').getAttribute('aria-checked')).toBe('false')
  })

  it('emits an array containing the new type when an unchecked box is clicked', async () => {
    const { onUpdate, user } = renderMenu([])
    await user.click(getCheckbox('video'))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith(['video'])
  })

  it('emits an array without the type when a checked box is clicked again', async () => {
    const { onUpdate, user } = renderMenu(['image', 'audio'])
    await user.click(getCheckbox('audio'))

    expect(onUpdate).toHaveBeenCalledWith(['image'])
  })

  it('appends to the existing filter list rather than replacing it', async () => {
    const { onUpdate, user } = renderMenu(['image'])
    await user.click(getCheckbox('video'))

    expect(onUpdate).toHaveBeenCalledWith(['image', 'video'])
  })

  it('toggles via keyboard (Enter and Space)', async () => {
    const { onUpdate, user } = renderMenu([])

    getCheckbox('image').focus()
    await user.keyboard('{Enter}')
    expect(onUpdate).toHaveBeenLastCalledWith(['image'])

    getCheckbox('audio').focus()
    await user.keyboard(' ')
    expect(onUpdate).toHaveBeenLastCalledWith(['audio'])
  })
})
