import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { createI18n } from 'vue-i18n'

import type { AssetKind } from '@/types/widgetTypes'

import FormDropdownMenuItem from './FormDropdownMenuItem.vue'
import { AssetKindKey } from './types'
import type { FormDropdownMenuItemProps } from './types'

const selectedLabel = 'Selected'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { selected: selectedLabel } } }
})

function renderItem(
  props: Partial<FormDropdownMenuItemProps> = {},
  {
    assetKind,
    listeners = {}
  }: {
    assetKind?: AssetKind
    listeners?: Record<string, (...args: unknown[]) => void>
  } = {}
) {
  const kind: ComputedRef<AssetKind | undefined> = computed(() => assetKind)
  return render(FormDropdownMenuItem, {
    global: {
      plugins: [i18n],
      provide: { [AssetKindKey as symbol]: kind },
      directives: { tooltip: () => {} }
    },
    props: {
      index: 0,
      selected: false,
      previewUrl: '',
      name: 'item_name',
      layout: 'list',
      ...props
    },
    attrs: listeners
  })
}

describe('FormDropdownMenuItem', () => {
  describe('Label and name', () => {
    it('renders name when no label is provided', () => {
      renderItem({ name: 'alpha' })
      expect(screen.getByText('alpha')).toBeInTheDocument()
    })

    it('prefers label over name when both are provided', () => {
      renderItem({ name: 'alpha', label: 'Alpha Display' })
      expect(screen.getByText('Alpha Display')).toBeInTheDocument()
      expect(screen.queryByText('alpha')).toBeNull()
    })
  })

  describe('Media rendering', () => {
    it('renders an img tag when assetKind is image', () => {
      renderItem({ previewUrl: '/p.png', name: 'pic' }, { assetKind: 'image' })
      const img = screen.getByRole('img', { name: 'pic' })
      expect(img).toHaveAttribute('src', '/p.png')
    })

    it('renders a video tag when assetKind is video', () => {
      renderItem({ previewUrl: '/v.mp4', name: 'clip' }, { assetKind: 'video' })
      const video = screen.getByLabelText('clip')
      expect(video.tagName).toBe('VIDEO')
      expect(video).toHaveAttribute('src', '/v.mp4')
    })

    it('renders a placeholder gradient when previewUrl is empty', () => {
      renderItem({ previewUrl: '' }, { assetKind: 'image' })
      expect(screen.queryByRole('img', { name: 'item_name' })).toBeNull()
      expect(screen.queryByLabelText('item_name')).toBeNull()
    })

    it('omits media area entirely for list-small layout', () => {
      renderItem(
        { previewUrl: '/p.png', layout: 'list-small' },
        { assetKind: 'image' }
      )
      expect(screen.queryByRole('img', { name: 'item_name' })).toBeNull()
    })
  })

  describe('Events', () => {
    it('emits click with index when the row is clicked', async () => {
      const onClick = vi.fn()
      renderItem({ index: 3 }, { listeners: { onClick } })
      const user = userEvent.setup()
      await user.click(screen.getByText('item_name'))
      expect(onClick).toHaveBeenCalledWith(3)
    })

    it('emits mediaLoad when the image finishes loading', async () => {
      const onMediaLoad = vi.fn()
      renderItem(
        { previewUrl: '/p.png', name: 'pic' },
        { assetKind: 'image', listeners: { onMediaLoad } }
      )
      await fireEvent.load(screen.getByRole('img', { name: 'pic' }))
      expect(onMediaLoad).toHaveBeenCalledTimes(1)
    })
  })

  describe('Selected state', () => {
    it('renders a selection indicator when selected is true', () => {
      renderItem({ selected: true })
      expect(screen.getByLabelText(selectedLabel)).toBeInTheDocument()
    })

    it('does not render the selection indicator when selected is false', () => {
      renderItem({ selected: false })
      expect(screen.queryByLabelText(selectedLabel)).toBeNull()
    })
  })
})
