import { render, screen, fireEvent, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watchEffect } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'

import { downloadFile } from '@/base/common/downloadUtil'
import ImagePreview from '@/renderer/extensions/vueNodes/components/ImagePreview.vue'
import { openHdrViewer } from '@/services/hdrViewerService'
import type { NodeId } from '@/types/nodeId'
import type { NodeImage } from '@/types/nodeMedia'
import type { LightboxItem } from '@/types/lightboxItem'

// Mock downloadFile to avoid DOM errors
vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadFile: vi.fn()
}))

vi.mock(import('@/services/hdrViewerService'), () => ({
  openHdrViewer: vi.fn()
}))

vi.mock(import('@/platform/telemetry'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        editOrMaskImage: 'Edit or mask image',
        downloadImage: 'Download image',
        openInLightbox: 'Open in lightbox',
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
        gallery: 'Gallery'
      },
      hdrViewer: {
        hdrImage: 'HDR image',
        openInHdrViewer: 'Open in HDR Viewer'
      }
    }
  }
})

describe('ImagePreview', () => {
  const lightbox: {
    items: readonly LightboxItem[]
    activeIndex: number | null
  } = { items: [], activeIndex: null }

  const lightboxIsOpen = () => lightbox.activeIndex !== null
  const lightboxItem = () => {
    if (lightbox.activeIndex === null) throw new Error('lightbox is closed')
    return lightbox.items[lightbox.activeIndex]
  }
  const lightboxImage = () => {
    const item = lightboxItem()
    if (item.kind !== 'image') {
      throw new Error(`expected an image item, got ${item.kind}`)
    }
    return item
  }

  beforeEach(() => {
    lightbox.items = []
    lightbox.activeIndex = null
  })

  const defaultUrls = [
    '/api/view?filename=test1.png&type=output',
    '/api/view?filename=test2.png&type=output'
  ]

  const imagesOf = (...urls: string[]): NodeImage[] =>
    urls.map((url) => ({ url }))

  interface PreviewProps {
    images?: readonly NodeImage[]
    nodeId?: NodeId
  }

  function renderImagePreview({
    images = imagesOf(...defaultUrls),
    nodeId
  }: PreviewProps = {}) {
    const result = render(ImagePreview, {
      props: { images, nodeId },
      global: {
        plugins: [getActivePinia()!, i18n],
        stubs: {
          MediaLightbox: {
            props: ['items', 'activeIndex'],
            setup(props: Record<string, unknown>) {
              watchEffect(() => {
                lightbox.items =
                  (props.items as readonly LightboxItem[] | undefined) ?? []
                lightbox.activeIndex =
                  (props.activeIndex as number | null | undefined) ?? null
              })
            },
            template: '<div data-testid="media-lightbox" />'
          },
          'i-lucide:venetian-mask': true,
          'i-lucide:download': true,
          'i-lucide:x': true,
          'i-lucide:image-off': true
        }
      }
    })
    return {
      ...result,
      rerender: ({
        images = imagesOf(...defaultUrls),
        nodeId
      }: PreviewProps = {}) => result.rerender({ images, nodeId })
    }
  }

  async function switchToGallery(user: ReturnType<typeof userEvent.setup>) {
    const thumbnails = screen.getAllByRole('button', { name: /^View image/ })
    await user.click(thumbnails[0])
    await nextTick()
  }

  it('does not render when no images are provided', () => {
    renderImagePreview({ images: [] })

    expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument()
  })

  it('nests the lightbox inside the preview root, keeping the node single-rooted', () => {
    renderImagePreview()

    const preview = screen.getByTestId('image-preview')

    expect(within(preview).getByTestId('media-lightbox')).toBeInTheDocument()
  })

  it('offers the HDR viewer instead of an <img> for exr outputs', () => {
    renderImagePreview({
      images: imagesOf('/api/view?filename=out.exr&type=output')
    })

    expect(screen.getByTestId('hdr-open-button')).toBeInTheDocument()
    expect(screen.queryByTestId('main-image')).not.toBeInTheDocument()
  })

  it('displays calculating dimensions text in gallery mode', async () => {
    renderImagePreview({
      images: imagesOf(defaultUrls[0])
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
      images: imagesOf(defaultUrls[0])
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
      images: imagesOf(defaultUrls[0])
    })

    screen.getByRole('button', { name: 'Edit or mask image' })
  })

  it('hides mask and download buttons when image fails to load', async () => {
    renderImagePreview({
      images: imagesOf(defaultUrls[0])
    })

    expect(
      screen.getByRole('button', { name: 'Edit or mask image' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Download image' })
    ).toBeInTheDocument()

    await fireEvent.error(screen.getByTestId('main-image'))
    await nextTick()

    expect(
      screen.queryByRole('button', { name: 'Edit or mask image' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Download image' })
    ).not.toBeInTheDocument()
    expect(
      useTelemetry()?.trackImageLoadFailed
    ).toHaveBeenCalledExactlyOnceWith({
      source: 'node_image_preview'
    })
  })

  it('handles download button click', async () => {
    renderImagePreview({
      images: imagesOf(defaultUrls[0])
    })
    const user = userEvent.setup()

    const downloadButton = screen.getByRole('button', {
      name: 'Download image'
    })
    await user.click(downloadButton)

    expect(downloadFile).toHaveBeenCalledWith(defaultUrls[0])
  })

  describe('opening the lightbox from the node preview', () => {
    it('opens the lightbox on the image the grid switched to', async () => {
      renderImagePreview()
      const user = userEvent.setup()

      await user.click(
        screen.getByRole('button', { name: 'View image 2 of 2' })
      )
      await nextTick()
      await user.dblClick(screen.getByRole('region'))

      expect(lightboxImage().alt).toBe('test2.png')
    })

    it('opens the lightbox from the gallery panel of a single image', async () => {
      renderImagePreview({ images: imagesOf(defaultUrls[0]) })
      const user = userEvent.setup()

      await user.dblClick(screen.getByRole('region'))

      expect(lightboxItem().url).toBe(defaultUrls[0])
    })

    it('names the image from the record the backend sent, not the url', async () => {
      renderImagePreview({
        images: [
          {
            url: '/api/view?filename=p.png',
            result: {
              filename: 'original name.png',
              subfolder: 'nested/dir',
              type: 'temp'
            }
          }
        ]
      })
      const user = userEvent.setup()

      await user.dblClick(screen.getByRole('region'))

      expect(lightboxItem()).toEqual({
        kind: 'image',
        url: '/api/view?filename=p.png',
        alt: 'original name.png'
      })
    })

    it('falls back to the url filename when no record backs the image', async () => {
      renderImagePreview({
        images: imagesOf('/api/view?filename=p.png')
      })
      const user = userEvent.setup()

      await user.dblClick(screen.getByRole('region'))

      expect(lightboxImage().alt).toBe('p.png')
      expect(lightboxItem().url).toBe('/api/view?filename=p.png')
    })

    it('opens the lightbox at full resolution', async () => {
      renderImagePreview({
        images: imagesOf('/api/view?filename=test1.png&preview=webp;75&rand=1')
      })
      const user = userEvent.setup()

      await user.dblClick(screen.getByRole('region'))

      expect(lightboxItem().url).toBe('/api/view?filename=test1.png&rand=1')
    })

    it('routes hdr outputs to the hdr viewer instead of the lightbox', async () => {
      const hdrUrl = '/api/view?filename=out.exr&type=output'
      renderImagePreview({ images: imagesOf(hdrUrl) })
      const user = userEvent.setup()

      await user.dblClick(screen.getByTestId('hdr-open-button'))

      expect(openHdrViewer).toHaveBeenCalledExactlyOnceWith(hdrUrl)
      expect(lightboxIsOpen()).toBe(false)
    })

    it('leaves hdr outputs out of a mixed lightbox gallery', async () => {
      renderImagePreview({
        images: imagesOf(
          '/api/view?filename=out.exr&type=output',
          defaultUrls[0],
          defaultUrls[1]
        )
      })
      const user = userEvent.setup()

      await user.click(
        screen.getByRole('button', { name: 'View image 3 of 3' })
      )
      await nextTick()
      await user.dblClick(screen.getByRole('region'))

      expect(lightbox.items.map(({ url }) => url)).toEqual(defaultUrls)
      expect(lightboxItem().url).toBe(defaultUrls[1])
    })

    it('opens the lightbox from below the gallery panel', async () => {
      renderImagePreview()
      const user = userEvent.setup()

      await user.click(
        screen.getByRole('button', { name: 'View image 2 of 2' })
      )
      await nextTick()
      await user.dblClick(screen.getByText('Calculating dimensions'))

      expect(lightboxItem().url).toBe(defaultUrls[1])
    })

    it('does not open the lightbox while the grid is showing', async () => {
      renderImagePreview()
      const user = userEvent.setup()

      await user.dblClick(screen.getByTestId('image-grid'))

      expect(lightboxIsOpen()).toBe(false)
    })

    const transientUrlCases = [
      ['live preview blob', 'blob:http://localhost:5173/abc-123'],
      ['webcam data url', 'data:image/png;base64,iVBORw0KGgo=']
    ] as const

    it.for(transientUrlCases)(
      'hides the lightbox button for a %s',
      ([_label, imageUrl]) => {
        renderImagePreview({ images: imagesOf(imageUrl) })

        expect(
          screen.queryByRole('button', { name: 'Open in lightbox' })
        ).not.toBeInTheDocument()
        expect(
          screen.getByRole('button', { name: 'Download image' })
        ).toBeInTheDocument()
      }
    )

    it.for(transientUrlCases)(
      'does not put a %s into the lightbox',
      async ([_label, imageUrl]) => {
        renderImagePreview({ images: imagesOf(imageUrl) })
        const user = userEvent.setup()

        await user.dblClick(screen.getByRole('region'))

        expect(lightboxIsOpen()).toBe(false)
      }
    )

    it('opens the lightbox from the named action button', async () => {
      renderImagePreview({ images: imagesOf(defaultUrls[0]) })
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Open in lightbox' }))

      expect(lightboxIsOpen()).toBe(true)
    })

    it('opens the lightbox when the action button is activated by keyboard', async () => {
      renderImagePreview({ images: imagesOf(defaultUrls[0]) })
      const user = userEvent.setup()

      screen.getByRole('button', { name: 'Open in lightbox' }).focus()
      await user.keyboard('{Enter}')

      expect(lightboxIsOpen()).toBe(true)
    })

    it('does not open the lightbox when a control is double-clicked', async () => {
      renderImagePreview({ images: imagesOf(defaultUrls[0]) })
      const user = userEvent.setup()

      await user.dblClick(
        screen.getByRole('button', { name: 'Download image' })
      )

      expect(lightboxIsOpen()).toBe(false)
    })

    it('does not open the lightbox for an image that failed to load', async () => {
      renderImagePreview({ images: imagesOf(defaultUrls[0]) })
      const user = userEvent.setup()

      await fireEvent.error(screen.getByTestId('main-image'))
      await nextTick()
      await user.dblClick(screen.getByRole('region'))

      expect(lightboxIsOpen()).toBe(false)
    })
  })

  it('switches images when navigation dots are clicked', async () => {
    renderImagePreview()
    const user = userEvent.setup()
    await switchToGallery(user)

    // Initially shows first image
    expect(screen.getByRole('img')).toHaveAttribute('src', defaultUrls[0])

    // Click second navigation dot
    const navigationDots = screen.getAllByRole('button', {
      name: /View image/
    })
    await user.click(navigationDots[1])
    await nextTick()

    expect(screen.getByRole('img')).toHaveAttribute('src', defaultUrls[1])
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
      images: imagesOf(defaultUrls[0])
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
      renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      screen.getByRole('region').focus()
      await user.keyboard('{ArrowRight}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultUrls[1]
      )
    })

    it('navigates to previous image with ArrowLeft', async () => {
      renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      screen.getByRole('region').focus()
      await user.keyboard('{ArrowRight}')
      await nextTick()

      await user.keyboard('{ArrowLeft}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultUrls[0]
      )
    })

    it('wraps around from last to first with ArrowRight', async () => {
      renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      screen.getByRole('region').focus()
      await user.keyboard('{ArrowRight}')
      await nextTick()
      await user.keyboard('{ArrowRight}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultUrls[0]
      )
    })

    it('wraps around from first to last with ArrowLeft', async () => {
      renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      screen.getByRole('region').focus()
      await user.keyboard('{ArrowLeft}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultUrls[1]
      )
    })

    it('navigates to first image with Home', async () => {
      renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      screen.getByRole('region').focus()
      await user.keyboard('{ArrowRight}')
      await nextTick()

      await user.keyboard('{Home}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultUrls[0]
      )
    })

    it('navigates to last image with End', async () => {
      renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)

      screen.getByRole('region').focus()
      await user.keyboard('{End}')
      await nextTick()

      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        defaultUrls[1]
      )
    })

    it('ignores arrow keys in grid mode', async () => {
      renderImagePreview()
      const user = userEvent.setup()

      const gridThumbnails = screen.getAllByRole('button', {
        name: /^View image/
      })
      expect(gridThumbnails).toHaveLength(2)

      gridThumbnails[0].focus()
      await user.keyboard('{ArrowRight}')
      await nextTick()

      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('ignores arrow keys for single image', async () => {
      renderImagePreview({
        images: imagesOf(defaultUrls[0])
      })
      const user = userEvent.setup()

      const initialSrc = screen.getByRole('img').getAttribute('src')
      screen.getByRole('region').focus()
      await user.keyboard('{ArrowRight}')
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

    it('requests lightweight thumbnails for grid cells instead of full-resolution images', () => {
      renderImagePreview()

      const gridImages = screen.getAllByRole('img')
      expect(gridImages).toHaveLength(2)
      for (const img of gridImages) {
        expect(img.getAttribute('src')).toMatch(/[?&]preview=/)
      }
    })

    it('defaults to gallery mode for single image', () => {
      renderImagePreview({
        images: imagesOf(defaultUrls[0])
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
      expect(mainImg).toHaveAttribute('src', defaultUrls[1])
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
        images: imagesOf(
          '/api/view?filename=new1.png&type=output',
          '/api/view?filename=new2.png&type=output',
          '/api/view?filename=new3.png&type=output'
        )
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
      const sameUrl = '/api/view?filename=test.png&type=output'
      renderImagePreview({
        images: imagesOf(sameUrl, sameUrl, sameUrl)
      })
      await switchToGallery(userEvent.setup())

      // Simulate initial image load
      await fireEvent.load(screen.getByTestId('main-image'))
      await nextTick()
      expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'false')

      // Click second navigation dot to cycle
      const dots = screen.getAllByRole('button', { name: /View image/ })
      await userEvent.setup().click(dots[1])
      await nextTick()

      // Advance past the delayed loader timeout
      await vi.advanceTimersByTimeAsync(300)
      await nextTick()

      // Should NOT be in loading state since URL didn't change
      expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'false')
    })
  })

  describe('URL change detection', () => {
    it('should NOT reset loading state when images prop is reassigned with identical URLs', async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime
      })
      const urls = ['/api/view?filename=test.png&type=output']
      const { rerender } = renderImagePreview({ images: imagesOf(...urls) })
      void user

      // Simulate image load completing
      await fireEvent.load(screen.getByRole('img'))
      await nextTick()

      // Verify loader is hidden after load
      expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'false')

      // Reassign with new array reference but same content
      await rerender({ images: imagesOf(...urls) })
      await nextTick()

      // Advance past the 250ms delayed loader timeout
      await vi.advanceTimersByTimeAsync(300)
      await nextTick()

      // Loading state should NOT have been reset
      expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'false')
    })

    it('should reset loading state when images prop changes to different URLs', async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime
      })
      const urls = ['/api/view?filename=test.png&type=output']
      const { rerender } = renderImagePreview({ images: imagesOf(...urls) })

      // Simulate image load completing
      await fireEvent.load(screen.getByRole('img'))
      await nextTick()

      // Verify loader is hidden
      expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'false')

      void user
      // Change to different URL
      await rerender({
        images: imagesOf('/api/view?filename=different.png&type=output')
      })
      await nextTick()

      // Advance past the 250ms delayed loader timeout
      await vi.advanceTimersByTimeAsync(300)
      await nextTick()

      expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'true')
    })

    it('should handle empty to non-empty URL transitions correctly', async () => {
      const { rerender } = renderImagePreview({ images: imagesOf() })

      expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument()

      await rerender({
        images: imagesOf('/api/view?filename=test.png&type=output')
      })
      await nextTick()

      expect(screen.getByTestId('image-preview')).toBeInTheDocument()
      screen.getByRole('img')
    })
  })
})
