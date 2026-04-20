import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { AssetKind } from '@/types/widgetTypes'

import FormDropdownMenuItem from './FormDropdownMenuItem.vue'
import { AssetKindKey } from './types'
import type { LayoutMode } from './types'

type ItemProps = {
  index: number
  selected: boolean
  previewUrl: string
  name: string
  label?: string
  layout?: LayoutMode
}

function renderItem(
  props: Partial<ItemProps> = {},
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
      provide: { [AssetKindKey as symbol]: kind },
      directives: { tooltip: () => {} }
    },
    props: {
      index: 0,
      selected: false,
      previewUrl: '',
      name: 'item_name',
      layout: 'list' as LayoutMode,
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
      const { container } = renderItem(
        { previewUrl: '/p.png', name: 'pic' },
        { assetKind: 'image' }
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const img = container.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', '/p.png')
    })

    it('renders a video tag when assetKind is video', () => {
      const { container } = renderItem(
        { previewUrl: '/v.mp4' },
        { assetKind: 'video' }
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const video = container.querySelector('video')
      expect(video).toBeInTheDocument()
      expect(video).toHaveAttribute('src', '/v.mp4')
    })

    it('renders a placeholder gradient when previewUrl is empty', () => {
      const { container } = renderItem(
        { previewUrl: '' },
        { assetKind: 'image' }
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('img')).toBeNull()
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('video')).toBeNull()
    })

    it('omits media area entirely for list-small layout', () => {
      const { container } = renderItem(
        { previewUrl: '/p.png', layout: 'list-small' },
        { assetKind: 'image' }
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('img')).toBeNull()
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
      const { container } = renderItem(
        { previewUrl: '/p.png' },
        { assetKind: 'image', listeners: { onMediaLoad } }
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const img = container.querySelector('img') as HTMLImageElement
      await fireEvent.load(img)
      expect(onMediaLoad).toHaveBeenCalledTimes(1)
    })
  })

  describe('Selected state', () => {
    const CHECK_SELECTOR = '.icon-\\[lucide--check\\]'

    it('renders a selection indicator when selected is true', () => {
      const { container } = renderItem({ selected: true })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const checkIcon = container.querySelector(CHECK_SELECTOR)
      expect(checkIcon).toBeInTheDocument()
    })

    it('does not render the selection indicator when selected is false', () => {
      const { container } = renderItem({ selected: false })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const checkIcon = container.querySelector(CHECK_SELECTOR)
      expect(checkIcon).toBeNull()
    })
  })
})
