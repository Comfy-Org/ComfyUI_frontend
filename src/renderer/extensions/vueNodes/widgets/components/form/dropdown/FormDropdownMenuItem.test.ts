import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import FormDropdownMenuItem from './FormDropdownMenuItem.vue'
import type { FormDropdownMenuItemProps } from './types'

const mockFindServerPreviewUrl = vi.hoisted(() => vi.fn())
const mockIsAssetPreviewSupported = vi.hoisted(() => vi.fn(() => true))
const intersectionCallbacks = vi.hoisted(
  () => [] as Array<(entries: Array<{ isIntersecting: boolean }>) => void>
)

vi.mock(import('@/platform/assets/utils/assetPreviewUtil'), () => ({
  findServerPreviewUrl: (name: string) => mockFindServerPreviewUrl(name),
  isAssetPreviewSupported: () => mockIsAssetPreviewSupported()
}))

vi.mock<unknown>(import('@vueuse/core'), () => ({
  useIntersectionObserver: (
    _ref: unknown,
    cb: (entries: Array<{ isIntersecting: boolean }>) => void
  ) => {
    intersectionCallbacks.push(cb)
    return { stop: vi.fn() }
  }
}))

const selectedLabel = 'Selected'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { selected: selectedLabel } } }
})

const imageThumbnail = (src?: string) => ({
  src,
  icon: 'icon-[lucide--image]',
  isVideo: false
})

function renderItem(
  props: Partial<FormDropdownMenuItemProps> = {},
  listeners: Record<string, (...args: unknown[]) => void> = {}
) {
  return render(FormDropdownMenuItem, {
    global: { plugins: [i18n] },
    props: {
      index: 0,
      selected: false,
      thumbnail: imageThumbnail(),
      name: 'item_name',
      layout: 'list',
      ...props
    },
    attrs: listeners
  })
}

function fireIntersection(isIntersecting = true) {
  for (const cb of intersectionCallbacks) {
    cb([{ isIntersecting }])
  }
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('FormDropdownMenuItem', () => {
  beforeEach(() => {
    intersectionCallbacks.length = 0
    mockIsAssetPreviewSupported.mockReset().mockReturnValue(true)
  })

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
    it('renders an img tag for an image thumbnail', () => {
      renderItem({ thumbnail: imageThumbnail('/p.png'), name: 'pic' })
      const img = screen.getByRole('img', { name: 'pic' })
      expect(img).toHaveAttribute('src', '/p.png')
    })

    it('renders a video tag for a video thumbnail', () => {
      renderItem({
        thumbnail: {
          src: '/v.mp4',
          icon: 'icon-[lucide--video]',
          isVideo: true
        },
        name: 'clip'
      })
      const video = screen.getByLabelText('clip')
      expect(video.tagName).toBe('VIDEO')
      expect(video).toHaveAttribute('src', '/v.mp4')
    })

    it('renders the placeholder instead of media when there is no src', () => {
      renderItem({ thumbnail: imageThumbnail() })
      expect(screen.queryByRole('img', { name: 'item_name' })).toBeNull()
      expect(screen.getByTestId('dropdown-item-media-placeholder')).toBeTruthy()
    })

    it('omits media area entirely for list-small layout', () => {
      renderItem({ thumbnail: imageThumbnail('/p.png'), layout: 'list-small' })
      expect(screen.queryByRole('img', { name: 'item_name' })).toBeNull()
    })

    it('does not look up mesh preview for a non-mesh item', async () => {
      renderItem({ thumbnail: imageThumbnail('/preview.png'), name: 'pic.png' })
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).not.toHaveBeenCalled()
    })
  })

  describe('Mesh thumbnail resolution', () => {
    it('shows the placeholder icon when mesh preview is unresolved', () => {
      renderItem({ name: '3d/model.glb' })
      expect(screen.getByTestId('dropdown-item-media-placeholder')).toBeTruthy()
    })

    it('looks up preview with basename after intersection fires', async () => {
      mockFindServerPreviewUrl.mockResolvedValue('/api/view?preview=1')
      renderItem({ name: '3d/sub/model.glb' })
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).toHaveBeenCalledWith('model.glb')
    })

    it('strips [output] suffix before taking basename', async () => {
      mockFindServerPreviewUrl.mockResolvedValue(null)
      renderItem({ name: 'mesh/scene.glb [output]' })
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).toHaveBeenCalledWith('scene.glb')
    })

    it('renders resolved URL in img once findServerPreviewUrl returns', async () => {
      mockFindServerPreviewUrl.mockResolvedValue('/api/preview/resolved.png')
      renderItem({ name: '3d/model.glb' })
      fireIntersection(true)
      const img = (await screen.findByAltText(
        '3d/model.glb'
      )) as HTMLImageElement
      expect(img.getAttribute('src')).toBe('/api/preview/resolved.png')
    })

    it('skips lookup when asset preview is unsupported', async () => {
      mockIsAssetPreviewSupported.mockReturnValue(false)
      renderItem({ name: '3d/model.glb' })
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).not.toHaveBeenCalled()
    })

    it('only looks up once for repeated intersection events', async () => {
      mockFindServerPreviewUrl.mockResolvedValue(null)
      renderItem({ name: '3d/model.glb' })
      fireIntersection(true)
      fireIntersection(true)
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).toHaveBeenCalledTimes(1)
    })

    it('does not look up when not yet intersecting', async () => {
      renderItem({ name: '3d/model.glb' })
      fireIntersection(false)
      await flushPromises()
      expect(mockFindServerPreviewUrl).not.toHaveBeenCalled()
    })
  })

  describe('Events', () => {
    it('emits click with index when the row is clicked', async () => {
      const onClick = vi.fn()
      renderItem({ index: 3 }, { onClick })
      const user = userEvent.setup()
      await user.click(screen.getByText('item_name'))
      expect(onClick).toHaveBeenCalledWith(3)
    })

    it('emits mediaLoad when the image finishes loading', async () => {
      const onMediaLoad = vi.fn()
      renderItem(
        { thumbnail: imageThumbnail('/p.png'), name: 'pic' },
        { onMediaLoad }
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
