/* oxlint-disable testing-library/no-container, testing-library/no-node-access */
/* oxlint-disable testing-library/prefer-user-event */
import { render, screen, fireEvent } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@comfyorg/telemetry'

import { downloadFile } from '@/base/common/downloadUtil'
import type { ResultItem } from '@comfyorg/api-client/executionTypes'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import ImagePreview from '@/renderer/extensions/vueNodes/components/ImagePreview.vue'
import { useImagePreviewStore } from '@/renderer/extensions/vueNodes/stores/imagePreviewStore'
import { openHdrViewer } from '@/services/hdrViewerService'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { resolveNode } from '@/utils/litegraphUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'

// Mock downloadFile to avoid DOM errors
vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadFile: vi.fn()
}))

vi.mock(import('@/services/hdrViewerService'), () => ({
  openHdrViewer: vi.fn()
}))

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('@/utils/litegraphUtil'), { spy: true })

function setZoom(scale: number) {
  useTransformState().syncWithCanvas(
    fromPartial<LGraphCanvas>({ ds: { offset: [0, 0], scale } })
  )
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        editOrMaskImage: 'Edit or mask image',
        downloadImage: 'Download image',
        downloadImages: 'Download images',
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
      },
      hdrViewer: {
        hdrImage: 'HDR image',
        openInHdrViewer: 'Open in HDR Viewer'
      }
    }
  }
})

function outputItem(
  filename: string,
  overrides: Partial<AugmentedResultItem> = {}
): AugmentedResultItem {
  return {
    filename,
    subfolder: '',
    type: 'output',
    mediaType: 'images',
    nodeId: '1',
    ...overrides
  }
}

function viewUrl(filename: string) {
  return `/api/view?filename=${filename}&type=output&subfolder=`
}

describe('ImagePreview', () => {
  beforeEach(() => {
    vi.mocked(useImagePreviewStore().getDisplayImage).mockImplementation(
      async (source) => ({ source })
    )
    setZoom(0.5)
  })

  const defaultProps = {
    items: [outputItem('test1.png'), outputItem('test2.png')]
  }
  const defaultUrls = [viewUrl('test1.png'), viewUrl('test2.png')]

  function renderImagePreview(props = {}) {
    return render(ImagePreview, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [getActivePinia()!, i18n],
        stubs: {
          'i-lucide:venetian-mask': true,
          'i-lucide:download': true,
          'i-lucide:x': true,
          'i-lucide:image-off': true
        }
      }
    })
  }

  async function switchToGallery(user: ReturnType<typeof userEvent.setup>) {
    const thumbnails = screen.getAllByRole('button', { name: /^View image/ })
    await user.click(thumbnails[0])
    await nextTick()
  }

  it('shows a downscaled copy while keeping the full-resolution source', async () => {
    const { getDisplayImage } = useImagePreviewStore()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:display-copy')
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    vi.mocked(getDisplayImage).mockResolvedValue({
      source: viewUrl('large.png'),
      blob: new Blob(['display pixels']),
      originalSize: { width: 4096, height: 2048 }
    })
    const { unmount } = renderImagePreview({
      items: [outputItem('large.png')]
    })

    const image = await screen.findByTestId<HTMLImageElement>('main-image')
    await vi.waitFor(() =>
      expect(image).toHaveAttribute('src', 'blob:display-copy')
    )
    expect(image).toHaveAttribute('data-full-src', viewUrl('large.png'))
    vi.spyOn(image, 'naturalWidth', 'get').mockReturnValue(1024)
    vi.spyOn(image, 'naturalHeight', 'get').mockReturnValue(512)
    await fireEvent.load(image)
    expect(screen.getByText('4096 x 2048')).toBeVisible()
    expect(revoke).not.toHaveBeenCalledWith('blob:display-copy')
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:display-copy')
  })

  it('clears the previous copy while the next gallery image is pending', async () => {
    const { getDisplayImage } = useImagePreviewStore()
    let nextCopy = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:copy-${nextCopy++}`
    )
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    let resolveNext = (
      _image: Awaited<ReturnType<typeof getDisplayImage>>
    ): void => {
      throw new Error('Next image promise was not initialized')
    }
    const next = new Promise<Awaited<ReturnType<typeof getDisplayImage>>>(
      (resolve) => {
        resolveNext = resolve
      }
    )
    vi.mocked(getDisplayImage)
      .mockResolvedValueOnce({
        source: defaultUrls[0],
        blob: new Blob(['first image'])
      })
      .mockReturnValueOnce(next)
    renderImagePreview()
    await nextTick()
    expect(getDisplayImage).not.toHaveBeenCalled()
    const user = userEvent.setup()
    await switchToGallery(user)
    await vi.waitFor(() =>
      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        'blob:copy-0'
      )
    )

    await user.click(screen.getByRole('button', { name: 'View image 2 of 2' }))
    expect(screen.getByTestId('main-image')).not.toHaveAttribute('src')
    expect(screen.getByTestId('main-image')).not.toHaveAttribute(
      'data-full-src'
    )
    await fireEvent.error(screen.getByTestId('main-image'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(revoke).toHaveBeenCalledWith('blob:copy-0')
    resolveNext({
      source: defaultUrls[1],
      blob: new Blob(['second image'])
    })
    await vi.waitFor(() =>
      expect(screen.getByTestId('main-image')).toHaveAttribute(
        'src',
        'blob:copy-1'
      )
    )
    expect(screen.getByTestId('main-image')).toHaveAttribute(
      'data-full-src',
      defaultUrls[1]
    )
    await user.keyboard('{Escape}')
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:copy-1'))
    expect(screen.queryByTestId('main-image')).not.toBeInTheDocument()
    expect(getDisplayImage).toHaveBeenCalledTimes(2)
  })

  describe('background preloading', () => {
    const batch = [0, 1, 2, 3].map((i) => viewUrl(`batch${i}.png`))
    const batchItems = [0, 1, 2, 3].map((i) => outputItem(`batch${i}.png`))

    it.for([
      { name: 'zoomed out', zoom: 0.5, preloaded: [] },
      { name: 'zoomed in', zoom: 1, preloaded: batch }
    ])(
      'preloads display copies of a grid only when $name',
      async ({ zoom, preloaded }) => {
        setZoom(zoom)
        renderImagePreview({ items: batchItems })
        await nextTick()

        const requested = vi
          .mocked(useImagePreviewStore().getDisplayImage)
          .mock.calls.map(([source]) => source)
        expect(requested).toEqual(preloaded)
      }
    )

    it('preloads only the gallery neighbors when zoomed in', async () => {
      setZoom(1)
      const { getDisplayImage } = useImagePreviewStore()
      renderImagePreview({ items: batchItems })
      const user = userEvent.setup()
      await switchToGallery(user)
      vi.mocked(getDisplayImage).mockClear()

      await user.keyboard('{ArrowRight}')
      await nextTick()

      const requested = vi
        .mocked(getDisplayImage)
        .mock.calls.map(([source]) => source)
      expect(requested).toEqual(
        expect.arrayContaining([batch[0], batch[1], batch[2]])
      )
      expect(requested).not.toContain(batch[3])
    })
  })

  it('does not render when no items provided', () => {
    const { container } = renderImagePreview({ items: [] })

    expect(container.querySelector('.image-preview')).not.toBeInTheDocument()
  })

  it.for([
    {
      name: 'a node with several saved outputs',
      props: { nodeId: '1' },
      images: [{ filename: 'test1.png' }, { filename: 'test2.png' }],
      expected: 1
    },
    {
      name: 'a node with a single saved output',
      props: { nodeId: '1' },
      images: [{ filename: 'test1.png' }],
      expected: 0
    },
    {
      name: 'previews that are not saved outputs',
      props: { nodeId: '1' },
      images: [],
      expected: 0
    },
    {
      name: 'images without a node',
      props: {},
      images: [{ filename: 'test1.png' }, { filename: 'test2.png' }],
      expected: 0
    }
  ] satisfies {
    name: string
    props: { nodeId?: string }
    images: ResultItem[]
    expected: number
  }[])(
    'offers downloading all images in the grid for $name',
    ({ props, images, expected }) => {
      vi.mocked(resolveNode).mockReturnValue(createMockLGraphNode({ id: 1 }))
      vi.spyOn(useNodeOutputStore(), 'getNodeOutputs').mockReturnValue({
        images
      })

      renderImagePreview(props)

      expect(
        screen.queryAllByRole('button', { name: 'Download images' })
      ).toHaveLength(expected)
    }
  )

  it('offers only the single image download in gallery view', async () => {
    vi.mocked(resolveNode).mockReturnValue(createMockLGraphNode({ id: 1 }))
    vi.spyOn(useNodeOutputStore(), 'getNodeOutputs').mockReturnValue({
      images: [{ filename: 'test1.png' }, { filename: 'test2.png' }]
    })
    renderImagePreview({ nodeId: '1' })
    const user = userEvent.setup()

    await switchToGallery(user)

    expect(
      screen.getByRole('button', { name: 'Download image' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Download images' })
    ).not.toBeInTheDocument()
  })

  it('offers the HDR viewer without a persistent loader for exr outputs', async () => {
    renderImagePreview({ items: [outputItem('out.exr')] })
    await vi.advanceTimersByTimeAsync(300)

    expect(screen.getByTestId('hdr-open-button')).toBeInTheDocument()
    expect(screen.queryByTestId('main-image')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('status', { name: 'Loading' })
    ).not.toBeInTheDocument()
  })

  it('shows the server preview of an exr output and still offers the HDR viewer', async () => {
    renderImagePreview({
      items: [outputItem('out.exr', { preview_id: 'p1' })]
    })
    const user = userEvent.setup()

    expect(screen.getByTestId('main-image')).toHaveAttribute(
      'src',
      '/api/assets/p1/content?disposition=inline'
    )

    await user.click(screen.getByRole('button', { name: 'Open in HDR Viewer' }))

    expect(openHdrViewer).toHaveBeenCalledWith(viewUrl('out.exr'))
  })

  it('displays calculating dimensions text in gallery mode', async () => {
    renderImagePreview({ items: [defaultProps.items[0]] })

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
    renderImagePreview({ items: [defaultProps.items[0]] })

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

  it('hides mask and download buttons when image fails to load', async () => {
    renderImagePreview({ items: [defaultProps.items[0]] })

    expect(
      screen.getByRole('button', { name: 'Edit or mask image' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Download image' })
    ).toBeInTheDocument()

    await vi.waitFor(() =>
      expect(screen.getByTestId('main-image')).toHaveAttribute('src')
    )
    await fireEvent.error(screen.getByTestId('main-image'))
    await nextTick()

    expect(
      screen.queryByRole('button', { name: 'Edit or mask image' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Download image' })
    ).not.toBeInTheDocument()
    // The report is emitted behind a diagnostic probe, so the error UI above
    // asserts synchronously while the telemetry needs the probe to settle.
    await vi.waitFor(() =>
      expect(
        useTelemetry()?.trackImageLoadFailed
      ).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          source: 'node_image_preview',
          probe_outcome: expect.any(String),
          page_age_ms: expect.any(Number)
        })
      )
    )
  })

  it('handles download button click', async () => {
    renderImagePreview({ items: [defaultProps.items[0]] })
    const user = userEvent.setup()

    const downloadButton = screen.getByRole('button', {
      name: 'Download image'
    })
    await user.click(downloadButton)

    expect(downloadFile).toHaveBeenCalledWith(defaultUrls[0])
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
    renderImagePreview({ items: [defaultProps.items[0]] })

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
    it.for([
      { keys: '{ArrowRight}', index: 1 },
      { keys: '{ArrowRight}{ArrowLeft}', index: 0 },
      { keys: '{ArrowRight}{ArrowRight}', index: 0 },
      { keys: '{ArrowLeft}', index: 1 },
      { keys: '{ArrowRight}{Home}', index: 0 },
      { keys: '{End}', index: 1 }
    ])('navigates with $keys to image $index', async ({ keys, index }) => {
      renderImagePreview()
      const user = userEvent.setup()
      await switchToGallery(user)
      await user.click(screen.getByRole('region'))

      await user.keyboard(keys)

      await vi.waitFor(() =>
        expect(screen.getByTestId('main-image')).toHaveAttribute(
          'src',
          defaultUrls[index]
        )
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
      renderImagePreview({
        items: [defaultProps.items[0]]
      })
      const user = userEvent.setup()
      await user.click(screen.getByRole('region'))

      await user.keyboard('{ArrowRight}')

      await vi.waitFor(() =>
        expect(screen.getByRole('img')).toHaveAttribute('src', defaultUrls[0])
      )
    })
  })

  describe('grid view', () => {
    it('defaults to gallery mode for single image', () => {
      renderImagePreview({ items: [defaultProps.items[0]] })

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
        items: [
          outputItem('new1.png'),
          outputItem('new2.png'),
          outputItem('new3.png')
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

  describe('legacy node image sync', () => {
    it('syncs the loaded image onto its node', async () => {
      const sync = vi.spyOn(useNodeOutputStore(), 'syncLegacyNodeImgs')
      renderImagePreview({
        items: [outputItem('test1.png', { type: 'input' })],
        nodeId: '1'
      })

      const img = screen.getByRole('img')
      await fireEvent.load(img)

      expect(sync).toHaveBeenCalledWith('1', img, 0)
    })

    it('ignores an image that finishes loading after unmount', async () => {
      const sync = vi.spyOn(useNodeOutputStore(), 'syncLegacyNodeImgs')
      const { unmount } = renderImagePreview({
        items: [outputItem('test1.png', { type: 'input' })],
        nodeId: '1'
      })
      const img = screen.getByRole('img')

      unmount()
      await fireEvent.load(img)

      expect(sync).not.toHaveBeenCalled()
    })
  })

  describe('batch cycling with identical URLs', () => {
    it('should not enter persistent loading state when cycling through identical images', async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime
      })
      const sameItem = outputItem('test.png')
      const { container } = renderImagePreview({
        items: [sameItem, { ...sameItem }, { ...sameItem }]
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
    })
  })

  describe('URL change detection', () => {
    it('should NOT reset loading state when items prop is reassigned with identical URLs', async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime
      })
      const items = [outputItem('test.png')]
      const { container, rerender } = renderImagePreview({ items })
      void user

      // Simulate image load completing
      await fireEvent.load(screen.getByRole('img'))
      await nextTick()

      // Verify loader is hidden after load
      expect(
        container.querySelector('[aria-busy="true"]')
      ).not.toBeInTheDocument()

      // Reassign with new array reference but same content
      await rerender({ items: items.map((item) => ({ ...item })) })
      await nextTick()

      // Advance past the 250ms delayed loader timeout
      await vi.advanceTimersByTimeAsync(300)
      await nextTick()

      // Loading state should NOT have been reset
      expect(
        container.querySelector('[aria-busy="true"]')
      ).not.toBeInTheDocument()
    })

    it('should reset loading state when items prop changes to different URLs', async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime
      })
      const items = [outputItem('test.png')]
      const { container, rerender } = renderImagePreview({ items })

      // Simulate image load completing
      await fireEvent.load(screen.getByRole('img'))
      await nextTick()

      // Verify loader is hidden
      expect(
        container.querySelector('[aria-busy="true"]')
      ).not.toBeInTheDocument()

      void user
      // Change to different URL
      await rerender({ items: [outputItem('different.png')] })
      await nextTick()

      // Advance past the 250ms delayed loader timeout
      await vi.advanceTimersByTimeAsync(300)
      await nextTick()

      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    })

    it('should handle empty to non-empty URL transitions correctly', async () => {
      const { container, rerender } = renderImagePreview({ items: [] })

      expect(container.querySelector('.image-preview')).not.toBeInTheDocument()

      await rerender({ items: [outputItem('test.png')] })
      await nextTick()

      expect(container.querySelector('.image-preview')).toBeInTheDocument()
      screen.getByRole('img')
    })
  })
})
