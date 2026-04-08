/* eslint-disable testing-library/no-container, testing-library/no-node-access */
/* eslint-disable testing-library/prefer-user-event */
import { createTestingPinia } from '@pinia/testing'
import { render, screen, fireEvent } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import ImagePreview from '@/renderer/extensions/vueNodes/components/ImagePreview.vue'

// Mock downloadFile to avoid DOM errors
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
        galleryThumbnail: 'Gallery thumbnail'
      }
    }
  }
})

describe('ImagePreview', () => {
  const defaultProps = {
    imageUrls: [
      '/api/view?filename=test1.png&type=output',
      '/api/view?filename=test2.png&type=output'
    ]
  }

  function renderImagePreview(props = {}) {
    return render(ImagePreview, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          }),
          i18n
        ],
        stubs: {
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
    const thumbnails = screen.getAllByRole('button', { name: /^View image/ })
    await user.click(thumbnails[0])
    await nextTick()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when no imageUrls provided', () => {
    const { container } = renderImagePreview({ imageUrls: [] })

    expect(container.querySelector('.image-preview')).not.toBeInTheDocument()
  })

  it('displays calculating dimensions text in gallery mode', async () => {
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    screen.getByText('Calculating dimensions')
  })

  it('shows navigation dots for multiple images in gallery mode', async () => {
    renderImagePreview()
    const user = userEvent.setup()
    await switchToGallery(user)

    const navigationDots = screen.getAllByRole('button', {
      name: /View image/
    })
    expect(navigationDots).toHaveLength(2)
  })

  it('does not show navigation dots for single image', () => {
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    const navigationDots = screen.queryAllByRole('button', {
      name: /View image/
    })
    expect(navigationDots).toHaveLength(0)
  })

  it('does not show mask/edit button for multiple images in gallery mode', async () => {
    renderImagePreview()
    const user = userEvent.setup()
    await switchToGallery(user)

    expect(
      screen.queryByRole('button', { name: 'Edit or mask image' })
    ).not.toBeInTheDocument()
  })

  it('shows mask/edit button for single images', () => {
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    screen.getByRole('button', { name: 'Edit or mask image' })
  })

  it('handles download button click', async () => {
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })
    const user = userEvent.setup()

    const downloadButton = screen.getByRole('button', {
      name: 'Download image'
    })
    await user.click(downloadButton)

    expect(downloadFile).toHaveBeenCalledWith(defaultProps.imageUrls[0])
  })

  it('switches images when navigation dots are clicked', async () => {
    renderImagePreview()
    const user = userEvent.setup()
    await switchToGallery(user)

    // Initially shows first image
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      defaultProps.imageUrls[0]
    )

    // Click second navigation dot
    const navigationDots = screen.getAllByRole('button', {
      name: /View image/
    })
    await user.click(navigationDots[1])
    await nextTick()

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      defaultProps.imageUrls[1]
    )
  })

  it('marks active navigation dot with aria-current', async () => {
    renderImagePreview()
    const user = userEvent.setup()
    await switchToGallery(user)

    const navigationDots = screen.getAllByRole('button', {
      name: /View image/
    })

    // First dot should be active
    expect(navigationDots[0]).toHaveAttribute('aria-current', 'true')
    expect(navigationDots[1]).not.toHaveAttribute('aria-current')

    await user.click(navigationDots[1])
    await nextTick()

    // Second dot should now be active
    expect(navigationDots[0]).not.toHaveAttribute('aria-current')
    expect(navigationDots[1]).toHaveAttribute('aria-current', 'true')
  })

  it('has proper accessibility attributes', () => {
    renderImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    expect(screen.getByRole('img')).toHaveAttribute('alt', 'View image 1 of 1')
  })

  it('updates alt text when switching images', async () => {
    renderImagePreview()
    const user = userEvent.setup()
    await switchToGallery(user)

    expect(screen.getByRole('img')).toHaveAttribute('alt', 'View image 1 of 2')

    // Switch to second image
    const navigationDots = screen.getAllByRole('button', {
      name: /View image/
    })
    await user.click(navigationDots[1])
    await nextTick()

    expect(screen.getByRole('img')).toHaveAttribute('alt', 'View image 2 of 2')
  })

  describe('keyboard navigation', () => {
    it('navigates to next image with ArrowRight', async () => {
      const { container } = renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      const preview = container.querySelector('.image-preview') as HTMLElement
      await fireEvent.keyDown(preview, { key: 'ArrowRight' })
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[1]
      )
    })

    it('navigates to previous image with ArrowLeft', async () => {
      const { container } = renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      const preview = container.querySelector('.image-preview') as HTMLElement
      await fireEvent.keyDown(preview, { key: 'ArrowRight' })
      await nextTick()

      await fireEvent.keyDown(preview, { key: 'ArrowLeft' })
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[0]
      )
    })

    it('wraps around from last to first with ArrowRight', async () => {
      const { container } = renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      const preview = container.querySelector('.image-preview') as HTMLElement
      await fireEvent.keyDown(preview, { key: 'ArrowRight' })
      await nextTick()
      await fireEvent.keyDown(preview, { key: 'ArrowRight' })
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[0]
      )
    })

    it('wraps around from first to last with ArrowLeft', async () => {
      const { container } = renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      const preview = container.querySelector('.image-preview') as HTMLElement
      await fireEvent.keyDown(preview, { key: 'ArrowLeft' })
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[1]
      )
    })

    it('navigates to first image with Home', async () => {
      const { container } = renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      const preview = container.querySelector('.image-preview') as HTMLElement
      await fireEvent.keyDown(preview, { key: 'ArrowRight' })
      await nextTick()

      await fireEvent.keyDown(preview, { key: 'Home' })
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[0]
      )
    })

    it('navigates to last image with End', async () => {
      const { container } = renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      const preview = container.querySelector('.image-preview') as HTMLElement
      await fireEvent.keyDown(preview, { key: 'End' })
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultProps.imageUrls[1]
      )
    })

    it('ignores arrow keys in grid mode', async () => {
      const { container } = renderImagePreview()

      const gridThumbnails = screen.getAllByRole('button', {
        name: /^View image/
      })
      expect(gridThumbnails).toHaveLength(2)

      const preview = container.querySelector('.image-preview') as HTMLElement
      await fireEvent.keyDown(preview, { key: 'ArrowRight' })
      await nextTick()

      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('ignores arrow keys for single image', async () => {
      const { container } = renderImagePreview({
        imageUrls: [defaultProps.imageUrls[0]]
      })

      const initialSrc = screen.getByRole('img').getAttribute('src')
      const preview = container.querySelector('.image-preview') as HTMLElement
      await fireEvent.keyDown(preview, { key: 'ArrowRight' })
      await nextTick()

      expect(screen.getByRole('img')).toHaveAttribute('src', initialSrc!)
    })
  })

  describe('grid view', () => {
    it('defaults to grid mode for multiple images', () => {
      renderImagePreview()

      const gridThumbnails = screen.getAllByRole('button', {
        name: /^View image/
      })
      expect(gridThumbnails).toHaveLength(2)
    })

    it('defaults to gallery mode for single image', () => {
      renderImagePreview({
        imageUrls: [defaultProps.imageUrls[0]]
      })

      screen.getByRole('region')
      const gridThumbnails = screen.queryAllByRole('button', {
        name: /^View image/
      })
      expect(gridThumbnails).toHaveLength(0)
    })

    it('switches to gallery mode when grid thumbnail is clicked', async () => {
      renderImagePreview()
      const user = userEvent.setup()

      const thumbnails = screen.getAllByRole('button', {
        name: /^View image/
      })
      await user.click(thumbnails[1])
      await nextTick()

      const mainImg = screen.getByTestId('main-image')
      expect(mainImg).toHaveAttribute('src', defaultProps.imageUrls[1])
    })

    it('shows back-to-grid button next to navigation dots', async () => {
      renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      const gridButtons = screen.getAllByRole('button', { name: 'Grid view' })
      expect(gridButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('switches back to grid mode via back-to-grid button', async () => {
      renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      const gridButtons = screen.getAllByRole('button', { name: 'Grid view' })
      await user.click(gridButtons[0])
      await nextTick()

      const gridThumbnails = screen.getAllByRole('button', {
        name: /^View image/
      })
      expect(gridThumbnails).toHaveLength(2)
    })

    it('resets to grid mode when URLs change to multiple images', async () => {
      const { rerender } = renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      // Verify we're in gallery mode
      screen.getByRole('region')

      // Change URLs
      await rerender({
        imageUrls: [
          '/api/view?filename=new1.png&type=output',
          '/api/view?filename=new2.png&type=output',
          '/api/view?filename=new3.png&type=output'
        ]
      })
      await nextTick()

      // Should be back in grid mode
      const gridThumbnails = screen.getAllByRole('button', {
        name: /^View image/
      })
      expect(gridThumbnails).toHaveLength(3)
    })
  })

  describe('batch cycling with identical URLs', () => {
    it('should not enter persistent loading state when cycling through identical images', async () => {
      vi.useFakeTimers()
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime
      })
      try {
        const sameUrl = '/api/view?filename=test.png&type=output'
        const { container } = renderImagePreview({
          imageUrls: [sameUrl, sameUrl, sameUrl]
        })
        await switchToGallery(user)

        // Simulate initial image load
        await fireEvent.load(screen.getByRole('img'))
        await nextTick()
        expect(
          container.querySelector('[aria-busy="true"]')
        ).not.toBeInTheDocument()

        // Click second navigation dot to cycle
        const dots = screen.getAllByRole('button', { name: /View image/ })
        await user.click(dots[1])
        await nextTick()

        // Advance past the delayed loader timeout
        await vi.advanceTimersByTimeAsync(300)
        await nextTick()

        // Should NOT be in loading state since URL didn't change
        expect(
          container.querySelector('[aria-busy="true"]')
        ).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('URL change detection', () => {
    it('should NOT reset loading state when imageUrls prop is reassigned with identical URLs', async () => {
      vi.useFakeTimers()
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime
      })
      try {
        const urls = ['/api/view?filename=test.png&type=output']
        const { container, rerender } = renderImagePreview({
          imageUrls: urls
        })
        void user

        // Simulate image load completing
        await fireEvent.load(screen.getByRole('img'))
        await nextTick()

        // Verify loader is hidden after load
        expect(
          container.querySelector('[aria-busy="true"]')
        ).not.toBeInTheDocument()

        // Reassign with new array reference but same content
        await rerender({ imageUrls: [...urls] })
        await nextTick()

        // Advance past the 250ms delayed loader timeout
        await vi.advanceTimersByTimeAsync(300)
        await nextTick()

        // Loading state should NOT have been reset
        expect(
          container.querySelector('[aria-busy="true"]')
        ).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('should reset loading state when imageUrls prop changes to different URLs', async () => {
      vi.useFakeTimers()
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime
      })
      try {
        const urls = ['/api/view?filename=test.png&type=output']
        const { container, rerender } = renderImagePreview({
          imageUrls: urls
        })

        // Simulate image load completing
        await fireEvent.load(screen.getByRole('img'))
        await nextTick()

        // Verify loader is hidden
        expect(
          container.querySelector('[aria-busy="true"]')
        ).not.toBeInTheDocument()

        void user
        // Change to different URL
        await rerender({
          imageUrls: ['/api/view?filename=different.png&type=output']
        })
        await nextTick()

        // Advance past the 250ms delayed loader timeout
        await vi.advanceTimersByTimeAsync(300)
        await nextTick()

        expect(
          container.querySelector('[aria-busy="true"]')
        ).toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('should handle empty to non-empty URL transitions correctly', async () => {
      const { container, rerender } = renderImagePreview({ imageUrls: [] })

      expect(container.querySelector('.image-preview')).not.toBeInTheDocument()

      await rerender({
        imageUrls: ['/api/view?filename=test.png&type=output']
      })
      await nextTick()

      expect(container.querySelector('.image-preview')).toBeInTheDocument()
      screen.getByRole('img')
    })
  })
})
