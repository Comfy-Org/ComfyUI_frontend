import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { createI18n } from 'vue-i18n'

import type { AssetKind } from '@/types/widgetTypes'

import FormDropdownMenuItem from './FormDropdownMenuItem.vue'
import { AssetKindKey } from './types'
import type { FormDropdownMenuItemProps } from './types'

const mockFindServerPreviewUrl = vi.hoisted(() => vi.fn())
const mockIsAssetPreviewSupported = vi.hoisted(() => vi.fn(() => true))
const intersectionCallbacks = vi.hoisted(
  () => [] as Array<(entries: Array<{ isIntersecting: boolean }>) => void>
)

vi.mock('@/platform/assets/utils/assetPreviewUtil', () => ({
  findServerPreviewUrl: (name: string) => mockFindServerPreviewUrl(name),
  isAssetPreviewSupported: () => mockIsAssetPreviewSupported()
}))

vi.mock('@vueuse/core', () => ({
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
    mockFindServerPreviewUrl.mockReset()
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

    it('does not look up mesh preview when kind is image', async () => {
      renderItem({ previewUrl: '/preview.png' }, { assetKind: 'image' })
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).not.toHaveBeenCalled()
    })
  })

  describe('Mesh thumbnail resolution', () => {
    it('shows 3D placeholder icon when mesh preview is unresolved', () => {
      renderItem({ name: '3d/model.glb' }, { assetKind: 'mesh' })
      expect(screen.getByTestId('dropdown-item-mesh-placeholder')).toBeTruthy()
    })

    it('looks up preview with basename after intersection fires', async () => {
      mockFindServerPreviewUrl.mockResolvedValue('/api/view?preview=1')
      renderItem({ name: '3d/sub/model.glb' }, { assetKind: 'mesh' })
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).toHaveBeenCalledWith('model.glb')
    })

    it('strips [output] suffix before taking basename', async () => {
      mockFindServerPreviewUrl.mockResolvedValue(null)
      renderItem({ name: 'mesh/scene.glb [output]' }, { assetKind: 'mesh' })
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).toHaveBeenCalledWith('scene.glb')
    })

    it('renders resolved URL in img once findServerPreviewUrl returns', async () => {
      mockFindServerPreviewUrl.mockResolvedValue('/api/preview/resolved.png')
      renderItem({ name: '3d/model.glb' }, { assetKind: 'mesh' })
      fireIntersection(true)
      const img = (await screen.findByAltText(
        '3d/model.glb'
      )) as HTMLImageElement
      expect(img.getAttribute('src')).toBe('/api/preview/resolved.png')
    })

    it('skips lookup when asset preview is unsupported', async () => {
      mockIsAssetPreviewSupported.mockReturnValue(false)
      renderItem({ name: '3d/model.glb' }, { assetKind: 'mesh' })
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).not.toHaveBeenCalled()
    })

    it('only looks up once for repeated intersection events', async () => {
      mockFindServerPreviewUrl.mockResolvedValue(null)
      renderItem({ name: '3d/model.glb' }, { assetKind: 'mesh' })
      fireIntersection(true)
      fireIntersection(true)
      fireIntersection(true)
      await flushPromises()
      expect(mockFindServerPreviewUrl).toHaveBeenCalledTimes(1)
    })

    it('does not look up when not yet intersecting', async () => {
      renderItem({ name: '3d/model.glb' }, { assetKind: 'mesh' })
      fireIntersection(false)
      await flushPromises()
      expect(mockFindServerPreviewUrl).not.toHaveBeenCalled()
    })

    it('ignores the previewUrl prop for mesh kind', async () => {
      mockFindServerPreviewUrl.mockResolvedValue(null)
      renderItem(
        {
          name: '3d/model.glb',
          previewUrl: '/api/view?filename=model.glb&type=input'
        },
        { assetKind: 'mesh' }
      )
      fireIntersection(true)
      await flushPromises()
      expect(screen.queryByAltText('3d/model.glb')).toBeNull()
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
