import { createTestingPinia } from '@pinia/testing'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const mockClearMask = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/composables/maskeditor/useMaskEditor', async () => {
  const { ref } = await import('vue')
  return {
    useMaskEditor: () => ({
      openMaskEditor: vi.fn(),
      clearMask: mockClearMask,
      isClearingMask: ref(false)
    })
  }
})

vi.mock('@/utils/litegraphUtil', () => ({
  resolveNode: vi.fn(() => undefined)
}))

import { downloadFile } from '@/base/common/downloadUtil'
import ImagePreview from '@/renderer/extensions/vueNodes/components/ImagePreview.vue'
import { resolveNode } from '@/utils/litegraphUtil'

vi.mock('@/base/common/downloadUtil', () => ({
  downloadFile: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        editOrMaskImage: 'Edit or mask image',
        downloadImage: 'Download image',
        removeImage: 'Remove image',
        viewImageOfTotal: 'View image {index} of {total}',
        imagePreview:
          'Image preview - Use arrow keys to navigate between images',
        errorLoadingImage: 'Error loading image',
        failedToDownloadImage: 'Failed to download image',
        calculatingDimensions: 'Calculating dimensions',
        imageFailedToLoad: 'Image failed to load',
        imageDoesNotExist: 'Image does not exist',
        unknownFile: 'Unknown file',
        loading: 'Loading',
        viewGrid: 'Grid view',
        galleryThumbnail: 'Gallery thumbnail',
        clearMask: 'Clear mask',
        imageGallery: 'image gallery'
      },
      maskEditor: {
        clearMaskError: 'Clear Mask Error',
        clearMaskFailed: 'Failed to clear mask. Please try again.'
      }
    }
  }
})

const defaultProps = {
  imageUrls: [
    '/api/view?filename=test1.png&type=output',
    '/api/view?filename=test2.png&type=output'
  ]
}

function renderImagePreview(props: Record<string, unknown> = {}) {
  return render(ImagePreview, {
    props: { ...defaultProps, ...props },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      stubs: {
        'i-comfy:mask': true,
        'i-lucide:venetian-mask': true,
        'i-lucide:download': true,
        'i-lucide:x': true,
        'i-lucide:image-off': true,
        Skeleton: true
      }
    }
  })
}

async function switchToGallery(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'View image 1 of 2' }))
  await nextTick()
}

function viewImageNavButtons() {
  return screen.getAllByRole('button', {
    name: /View image \d+ of \d+/
  })
}

describe('ImagePreview', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveNode).mockReturnValue(undefined)
  })

  it('does not render when no imageUrls provided', () => {
    renderImagePreview({ imageUrls: [] })

    expect(screen.queryByTestId('image-preview-root')).not.toBeInTheDocument()
  })

  it('displays calculating dimensions text in gallery mode', async () => {
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    expect(screen.getByText('Calculating dimensions')).toBeInTheDocument()
  })

  it('shows navigation dots for multiple images in gallery mode', async () => {
    const user = userEvent.setup()
    renderImagePreview()
    await switchToGallery(user)

    expect(viewImageNavButtons()).toHaveLength(2)
  })

  it('does not show navigation dots for single image', () => {
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    expect(
      screen.queryByRole('button', { name: /View image \d+ of \d+/ })
    ).not.toBeInTheDocument()
  })

  it('shows mask/edit button only for single images', async () => {
    const user = userEvent.setup()
    renderImagePreview()
    await switchToGallery(user)

    expect(
      screen.queryByRole('button', { name: 'Edit or mask image' })
    ).not.toBeInTheDocument()

    cleanup()
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    expect(
      screen.getByRole('button', { name: 'Edit or mask image' })
    ).toBeInTheDocument()
  })

  it('handles download button click', async () => {
    const user = userEvent.setup()
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    await user.click(screen.getByRole('button', { name: 'Download image' }))

    expect(downloadFile).toHaveBeenCalledWith(defaultProps.imageUrls[0])
  })

  it('calls clearMask with resolved node when clear mask is clicked', async () => {
    const stubNode = { id: 99, imgs: [] } as unknown as LGraphNode
    vi.mocked(resolveNode).mockReturnValue(stubNode)

    const user = userEvent.setup()
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]],
      nodeId: '99'
    })

    await user.click(screen.getByRole('button', { name: 'Clear mask' }))

    await waitFor(() => {
      expect(mockClearMask).toHaveBeenCalledTimes(1)
    })
    expect(mockClearMask).toHaveBeenCalledWith(stubNode)
  })

  it('switches images when navigation dots are clicked', async () => {
    const user = userEvent.setup()
    renderImagePreview()
    await switchToGallery(user)

    expect(screen.getByTestId('main-image')).toHaveAttribute(
      'src',
      defaultProps.imageUrls[0]
    )

    const navigationDots = viewImageNavButtons()
    await user.click(navigationDots[1])
    await nextTick()

    expect(screen.getByTestId('main-image')).toHaveAttribute(
      'src',
      defaultProps.imageUrls[1]
    )
  })

  it('marks active navigation dot with aria-current', async () => {
    const user = userEvent.setup()
    renderImagePreview()
    await switchToGallery(user)

    const navigationDots = viewImageNavButtons()

    expect(navigationDots[0]).toHaveAttribute('aria-current', 'true')
    expect(navigationDots[1]).not.toHaveAttribute('aria-current')

    await user.click(navigationDots[1])
    await nextTick()

    expect(navigationDots[0]).not.toHaveAttribute('aria-current')
    expect(navigationDots[1]).toHaveAttribute('aria-current', 'true')
  })

  it('has proper accessibility attributes', () => {
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    expect(screen.getByRole('img', { name: 'View image 1 of 1' })).toBeTruthy()
  })

  it('updates alt text when switching images', async () => {
    const user = userEvent.setup()
    renderImagePreview()
    await switchToGallery(user)

    expect(screen.getByTestId('main-image')).toHaveAttribute(
      'alt',
      'View image 1 of 2'
    )

    const navigationDots = viewImageNavButtons()
    await user.click(navigationDots[1])
    await nextTick()

    expect(screen.getByTestId('main-image')).toHaveAttribute(
      'alt',
      'View image 2 of 2'
    )
  })

  describe('keyboard navigation', () => {
    it('navigates to next image with ArrowRight', async () => {
      const user = userEvent.setup()
      renderImagePreview()
      await switchToGallery(user)

      await user.keyboard('{ArrowRight}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[1]
      )
    })

    it('navigates to previous image with ArrowLeft', async () => {
      const user = userEvent.setup()
      renderImagePreview()
      await switchToGallery(user)

      await user.keyboard('{ArrowRight}')
      await nextTick()
      await user.keyboard('{ArrowLeft}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[0]
      )
    })

    it('wraps around from last to first with ArrowRight', async () => {
      const user = userEvent.setup()
      renderImagePreview()
      await switchToGallery(user)

      await user.keyboard('{ArrowRight}')
      await nextTick()
      await user.keyboard('{ArrowRight}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[0]
      )
    })

    it('wraps around from first to last with ArrowLeft', async () => {
      const user = userEvent.setup()
      renderImagePreview()
      await switchToGallery(user)

      await user.keyboard('{ArrowLeft}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[1]
      )
    })

    it('navigates to first image with Home', async () => {
      const user = userEvent.setup()
      renderImagePreview()
      await switchToGallery(user)

      await user.keyboard('{ArrowRight}')
      await nextTick()
      await user.keyboard('{Home}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[0]
      )
    })

    it('navigates to last image with End', async () => {
      const user = userEvent.setup()
      renderImagePreview()
      await switchToGallery(user)

      await user.keyboard('{End}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[1]
      )
    })

    it('ignores arrow keys in grid mode', async () => {
      renderImagePreview()

      expect(
        screen.getAllByRole('button', { name: /View image \d+ of 2/ })
      ).toHaveLength(2)

      const root = screen.getByTestId('image-preview-root')
      // Thumbnail click opens gallery; grid-mode arrows are a no-op on the shell without moving focus into it.
      // eslint-disable-next-line testing-library/prefer-user-event -- need keydown on root while view stays grid
      void fireEvent.keyDown(root, { key: 'ArrowRight' })
      await nextTick()

      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('ignores arrow keys for single image', async () => {
      const user = userEvent.setup()
      renderImagePreview({
        imageUrls: [defaultProps.imageUrls[0]]
      })

      const img = screen.getByRole('img')
      const initialSrc = img.getAttribute('src')
      await user.click(
        screen.getByRole('region', {
          name: 'Image preview - Use arrow keys to navigate between images'
        })
      )
      await user.keyboard('{ArrowRight}')
      await nextTick()

      expect(screen.getByRole('img').getAttribute('src')).toBe(initialSrc)
    })
  })

  describe('grid view', () => {
    it('defaults to grid mode for multiple images', () => {
      renderImagePreview()

      expect(
        screen.getAllByRole('button', { name: /View image \d+ of 2/ })
      ).toHaveLength(2)
    })

    it('defaults to gallery mode for single image', () => {
      renderImagePreview({
        imageUrls: [defaultProps.imageUrls[0]]
      })

      expect(
        screen.getByRole('region', {
          name: 'Image preview - Use arrow keys to navigate between images'
        })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /View image \d+ of 1/ })
      ).not.toBeInTheDocument()
    })

    it('switches to gallery mode when grid thumbnail is clicked', async () => {
      const user = userEvent.setup()
      renderImagePreview()

      const thumbnails = screen.getAllByRole('button', {
        name: /View image \d+ of 2/
      })
      await user.click(thumbnails[1])
      await nextTick()

      const mainImg = screen.getByTestId('main-image')
      expect(mainImg).toBeInTheDocument()
      expect(mainImg).toHaveAttribute('src', defaultProps.imageUrls[1])
    })

    it('shows back-to-grid button next to navigation dots', async () => {
      const user = userEvent.setup()
      renderImagePreview()
      await switchToGallery(user)

      expect(
        screen.getAllByRole('button', { name: 'Grid view' })[0]
      ).toBeInTheDocument()
    })

    it('switches back to grid mode via back-to-grid button', async () => {
      const user = userEvent.setup()
      renderImagePreview()
      await switchToGallery(user)

      await user.click(screen.getAllByRole('button', { name: 'Grid view' })[0])
      await nextTick()

      expect(
        screen.getAllByRole('button', { name: /View image \d+ of 2/ })
      ).toHaveLength(2)
    })

    it('resets to grid mode when URLs change to multiple images', async () => {
      const user = userEvent.setup()
      const { rerender } = renderImagePreview()
      await switchToGallery(user)

      expect(
        screen.getByRole('region', {
          name: 'Image preview - Use arrow keys to navigate between images'
        })
      ).toBeInTheDocument()

      await rerender({
        imageUrls: [
          '/api/view?filename=new1.png&type=output',
          '/api/view?filename=new2.png&type=output',
          '/api/view?filename=new3.png&type=output'
        ]
      })
      await nextTick()

      expect(
        screen.getAllByRole('button', { name: /View image \d+ of 3/ })
      ).toHaveLength(3)
    })
  })

  describe('batch cycling with identical URLs', () => {
    it('should not enter persistent loading state when cycling through identical images', async () => {
      vi.useFakeTimers()
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const sameUrl = '/api/view?filename=test.png&type=output'
        renderImagePreview({
          imageUrls: [sameUrl, sameUrl, sameUrl]
        })
        await user.click(
          screen.getByRole('button', { name: 'View image 1 of 3' })
        )
        await nextTick()

        void fireEvent.load(screen.getByTestId('main-image'))
        await nextTick()
        expect(
          screen
            .getByRole('region', {
              name: 'Image preview - Use arrow keys to navigate between images'
            })
            .getAttribute('aria-busy')
        ).not.toBe('true')

        const dots = viewImageNavButtons()
        await user.click(dots[1])
        await nextTick()

        await vi.advanceTimersByTimeAsync(300)
        await nextTick()

        expect(
          screen
            .getByRole('region', {
              name: 'Image preview - Use arrow keys to navigate between images'
            })
            .getAttribute('aria-busy')
        ).not.toBe('true')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('URL change detection', () => {
    it('should NOT reset loading state when imageUrls prop is reassigned with identical URLs', async () => {
      vi.useFakeTimers()
      try {
        const urls = ['/api/view?filename=test.png&type=output']
        const { rerender } = renderImagePreview({ imageUrls: urls })

        void fireEvent.load(screen.getByTestId('main-image'))
        await nextTick()

        const region = screen.getByRole('region', {
          name: 'Image preview - Use arrow keys to navigate between images'
        })
        expect(region.getAttribute('aria-busy')).not.toBe('true')

        await rerender({ imageUrls: [...urls] })
        await nextTick()

        await vi.advanceTimersByTimeAsync(300)
        await nextTick()

        expect(
          screen
            .getByRole('region', {
              name: 'Image preview - Use arrow keys to navigate between images'
            })
            .getAttribute('aria-busy')
        ).not.toBe('true')
      } finally {
        vi.useRealTimers()
      }
    })

    it('should reset loading state when imageUrls prop changes to different URLs', async () => {
      vi.useFakeTimers()
      try {
        const urls = ['/api/view?filename=test.png&type=output']
        const { rerender } = renderImagePreview({ imageUrls: urls })

        void fireEvent.load(screen.getByTestId('main-image'))
        await nextTick()

        const region = screen.getByRole('region', {
          name: 'Image preview - Use arrow keys to navigate between images'
        })
        expect(region.getAttribute('aria-busy')).not.toBe('true')

        await rerender({
          imageUrls: ['/api/view?filename=different.png&type=output']
        })
        await nextTick()

        await vi.advanceTimersByTimeAsync(300)
        await nextTick()

        expect(
          screen.getByRole('region', {
            name: 'Image preview - Use arrow keys to navigate between images'
          })
        ).toHaveAttribute('aria-busy', 'true')
      } finally {
        vi.useRealTimers()
      }
    })

    it('should handle empty to non-empty URL transitions correctly', async () => {
      const { rerender } = renderImagePreview({ imageUrls: [] })

      expect(screen.queryByTestId('image-preview-root')).not.toBeInTheDocument()

      await rerender({
        imageUrls: ['/api/view?filename=test.png&type=output']
      })
      await nextTick()

      expect(screen.getByTestId('image-preview-root')).toBeInTheDocument()
      expect(screen.getByRole('img')).toBeInTheDocument()
    })
  })
})
