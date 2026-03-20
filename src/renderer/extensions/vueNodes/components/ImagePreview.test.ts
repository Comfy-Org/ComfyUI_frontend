import { createTestingPinia } from '@pinia/testing'
import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
        viewGallery: 'Gallery view',
        imageCount: '{count} images',
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
  const wrapperRegistry = new Set<VueWrapper>()

  const mountImagePreview = (props = {}) => {
    const wrapper = mount(ImagePreview, {
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
    wrapperRegistry.add(wrapper)
    return wrapper
  }

  /** Switch a multi-image wrapper from default grid mode to gallery mode */
  async function switchToGallery(wrapper: VueWrapper) {
    const thumbnails = wrapper.findAll('button[aria-label^="View image"]')
    await thumbnails[0].trigger('click')
    await nextTick()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    wrapperRegistry.forEach((wrapper) => {
      wrapper.unmount()
    })
    wrapperRegistry.clear()
  })

  it('does not render when no imageUrls provided', () => {
    const wrapper = mountImagePreview({ imageUrls: [] })

    expect(wrapper.find('.image-preview').exists()).toBe(false)
  })

  it('displays calculating dimensions text in gallery mode', async () => {
    const wrapper = mountImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    expect(wrapper.text()).toContain('Calculating dimensions')
  })

  it('shows navigation dots for multiple images in gallery mode', async () => {
    const wrapper = mountImagePreview()
    await switchToGallery(wrapper)

    const navigationDots = wrapper.findAll('[aria-label*="View image"]')
    expect(navigationDots).toHaveLength(2)
  })

  it('does not show navigation dots for single image', () => {
    const wrapper = mountImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    const navigationDots = wrapper.findAll('[aria-label*="View image"]')
    expect(navigationDots).toHaveLength(0)
  })

  it('shows mask/edit button only for single images', async () => {
    // Multiple images in gallery mode - should not show mask button
    const multipleImagesWrapper = mountImagePreview()
    await switchToGallery(multipleImagesWrapper)

    expect(
      multipleImagesWrapper.find('[aria-label="Edit or mask image"]').exists()
    ).toBe(false)

    // Single image - should show mask button
    const singleImageWrapper = mountImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    expect(
      singleImageWrapper.find('[aria-label="Edit or mask image"]').exists()
    ).toBe(true)
  })

  it('handles download button click', async () => {
    const wrapper = mountImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    const downloadButton = wrapper.find('[aria-label="Download image"]')
    expect(downloadButton.exists()).toBe(true)
    await downloadButton.trigger('click')

    expect(downloadFile).toHaveBeenCalledWith(defaultProps.imageUrls[0])
  })

  it('switches images when navigation dots are clicked', async () => {
    const wrapper = mountImagePreview()
    await switchToGallery(wrapper)

    // Initially shows first image
    expect(wrapper.find('img').attributes('src')).toBe(
      defaultProps.imageUrls[0]
    )

    // Click second navigation dot
    const navigationDots = wrapper.findAll('[aria-label*="View image"]')
    await navigationDots[1].trigger('click')
    await nextTick()

    expect(wrapper.find('img').attributes('src')).toBe(
      defaultProps.imageUrls[1]
    )
  })

  it('marks active navigation dot with aria-current', async () => {
    const wrapper = mountImagePreview()
    await switchToGallery(wrapper)

    const navigationDots = wrapper.findAll('[aria-label*="View image"]')

    // First dot should be active
    expect(navigationDots[0].attributes('aria-current')).toBe('true')
    expect(navigationDots[1].attributes('aria-current')).toBeUndefined()

    await navigationDots[1].trigger('click')
    await nextTick()

    // Second dot should now be active
    expect(navigationDots[0].attributes('aria-current')).toBeUndefined()
    expect(navigationDots[1].attributes('aria-current')).toBe('true')
  })

  it('has proper accessibility attributes', () => {
    const wrapper = mountImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    const img = wrapper.find('img')
    expect(img.attributes('alt')).toBe('View image 1 of 1')
  })

  it('updates alt text when switching images', async () => {
    const wrapper = mountImagePreview()
    await switchToGallery(wrapper)

    expect(wrapper.find('img').attributes('alt')).toBe('View image 1 of 2')

    // Switch to second image
    const navigationDots = wrapper.findAll('[aria-label*="View image"]')
    await navigationDots[1].trigger('click')
    await nextTick()

    expect(wrapper.find('img').attributes('alt')).toBe('View image 2 of 2')
  })

  describe('keyboard navigation', () => {
    it('navigates to next image with ArrowRight', async () => {
      const wrapper = mountImagePreview()
      await switchToGallery(wrapper)

      await wrapper
        .find('.image-preview')
        .trigger('keydown', { key: 'ArrowRight' })
      await nextTick()

      expect(wrapper.find('[data-testid="main-image"]').attributes('src')).toBe(
        defaultProps.imageUrls[1]
      )
    })

    it('navigates to previous image with ArrowLeft', async () => {
      const wrapper = mountImagePreview()
      await switchToGallery(wrapper)

      await wrapper
        .find('.image-preview')
        .trigger('keydown', { key: 'ArrowRight' })
      await nextTick()

      await wrapper
        .find('.image-preview')
        .trigger('keydown', { key: 'ArrowLeft' })
      await nextTick()

      expect(wrapper.find('[data-testid="main-image"]').attributes('src')).toBe(
        defaultProps.imageUrls[0]
      )
    })

    it('wraps around from last to first with ArrowRight', async () => {
      const wrapper = mountImagePreview()
      await switchToGallery(wrapper)

      await wrapper
        .find('.image-preview')
        .trigger('keydown', { key: 'ArrowRight' })
      await nextTick()
      await wrapper
        .find('.image-preview')
        .trigger('keydown', { key: 'ArrowRight' })
      await nextTick()

      expect(wrapper.find('[data-testid="main-image"]').attributes('src')).toBe(
        defaultProps.imageUrls[0]
      )
    })

    it('wraps around from first to last with ArrowLeft', async () => {
      const wrapper = mountImagePreview()
      await switchToGallery(wrapper)

      await wrapper
        .find('.image-preview')
        .trigger('keydown', { key: 'ArrowLeft' })
      await nextTick()

      expect(wrapper.find('[data-testid="main-image"]').attributes('src')).toBe(
        defaultProps.imageUrls[1]
      )
    })

    it('navigates to first image with Home', async () => {
      const wrapper = mountImagePreview()
      await switchToGallery(wrapper)

      await wrapper
        .find('.image-preview')
        .trigger('keydown', { key: 'ArrowRight' })
      await nextTick()

      await wrapper.find('.image-preview').trigger('keydown', { key: 'Home' })
      await nextTick()

      expect(wrapper.find('[data-testid="main-image"]').attributes('src')).toBe(
        defaultProps.imageUrls[0]
      )
    })

    it('navigates to last image with End', async () => {
      const wrapper = mountImagePreview()
      await switchToGallery(wrapper)

      await wrapper.find('.image-preview').trigger('keydown', { key: 'End' })
      await nextTick()

      expect(wrapper.find('[data-testid="main-image"]').attributes('src')).toBe(
        defaultProps.imageUrls[1]
      )
    })

    it('ignores arrow keys in grid mode', async () => {
      const wrapper = mountImagePreview()

      const gridThumbnails = wrapper.findAll('button[aria-label^="View image"]')
      expect(gridThumbnails).toHaveLength(2)

      await wrapper
        .find('.image-preview')
        .trigger('keydown', { key: 'ArrowRight' })
      await nextTick()

      expect(wrapper.find('[role="region"]').exists()).toBe(false)
    })

    it('ignores arrow keys for single image', async () => {
      const wrapper = mountImagePreview({
        imageUrls: [defaultProps.imageUrls[0]]
      })

      const initialSrc = wrapper.find('img').attributes('src')
      await wrapper
        .find('.image-preview')
        .trigger('keydown', { key: 'ArrowRight' })
      await nextTick()

      expect(wrapper.find('img').attributes('src')).toBe(initialSrc)
    })
  })

  describe('grid view', () => {
    it('defaults to grid mode for multiple images', () => {
      const wrapper = mountImagePreview()

      const gridThumbnails = wrapper.findAll('button[aria-label^="View image"]')
      expect(gridThumbnails).toHaveLength(2)
    })

    it('defaults to gallery mode for single image', () => {
      const wrapper = mountImagePreview({
        imageUrls: [defaultProps.imageUrls[0]]
      })

      expect(wrapper.find('[role="region"]').exists()).toBe(true)
      const gridThumbnails = wrapper.findAll('button[aria-label^="View image"]')
      expect(gridThumbnails).toHaveLength(0)
    })

    it('switches to gallery mode when grid thumbnail is clicked', async () => {
      const wrapper = mountImagePreview()

      const thumbnails = wrapper.findAll('button[aria-label^="View image"]')
      await thumbnails[1].trigger('click')
      await nextTick()

      const mainImg = wrapper.find('[data-testid="main-image"]')
      expect(mainImg.exists()).toBe(true)
      expect(mainImg.attributes('src')).toBe(defaultProps.imageUrls[1])
    })

    it('shows back-to-grid button next to navigation dots', async () => {
      const wrapper = mountImagePreview()
      await switchToGallery(wrapper)

      const gridButton = wrapper.find('[aria-label="Grid view"]')
      expect(gridButton.exists()).toBe(true)
    })

    it('switches back to grid mode via back-to-grid button', async () => {
      const wrapper = mountImagePreview()
      await switchToGallery(wrapper)

      const gridButton = wrapper.find('[aria-label="Grid view"]')
      await gridButton.trigger('click')
      await nextTick()

      const gridThumbnails = wrapper.findAll('button[aria-label^="View image"]')
      expect(gridThumbnails).toHaveLength(2)
    })

    it('shows gallery toggle in grid actions', () => {
      const wrapper = mountImagePreview()

      const galleryToggle = wrapper.find('[aria-label="Gallery view"]')
      expect(galleryToggle.exists()).toBe(true)
    })

    it('switches to gallery via action toggle', async () => {
      const wrapper = mountImagePreview()

      const galleryToggle = wrapper.find('[aria-label="Gallery view"]')
      await galleryToggle.trigger('click')
      await nextTick()

      expect(wrapper.find('[role="region"]').exists()).toBe(true)
    })

    it('shows image count in grid mode', () => {
      const wrapper = mountImagePreview()
      expect(wrapper.text()).toContain('2 images')
    })

    it('resets to grid mode when URLs change to multiple images', async () => {
      const wrapper = mountImagePreview()
      await switchToGallery(wrapper)

      // Verify we're in gallery mode
      expect(wrapper.find('[role="region"]').exists()).toBe(true)

      // Change URLs
      await wrapper.setProps({
        imageUrls: [
          '/api/view?filename=new1.png&type=output',
          '/api/view?filename=new2.png&type=output',
          '/api/view?filename=new3.png&type=output'
        ]
      })
      await nextTick()

      // Should be back in grid mode
      const gridThumbnails = wrapper.findAll('button[aria-label^="View image"]')
      expect(gridThumbnails).toHaveLength(3)
    })
  })

  describe('batch cycling with identical URLs', () => {
    it('should not enter persistent loading state when cycling through identical images', async () => {
      vi.useFakeTimers()
      try {
        const sameUrl = '/api/view?filename=test.png&type=output'
        const wrapper = mountImagePreview({
          imageUrls: [sameUrl, sameUrl, sameUrl]
        })
        await switchToGallery(wrapper)

        // Simulate initial image load
        await wrapper.find('img').trigger('load')
        await nextTick()
        expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)

        // Click second navigation dot to cycle
        const dots = wrapper.findAll('[aria-label*="View image"]')
        await dots[1].trigger('click')
        await nextTick()

        // Advance past the delayed loader timeout
        await vi.advanceTimersByTimeAsync(300)
        await nextTick()

        // Should NOT be in loading state since URL didn't change
        expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
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
        const wrapper = mountImagePreview({ imageUrls: urls })

        // Simulate image load completing
        const img = wrapper.find('img')
        await img.trigger('load')
        await nextTick()

        // Verify loader is hidden after load
        expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)

        // Reassign with new array reference but same content
        await wrapper.setProps({ imageUrls: [...urls] })
        await nextTick()

        // Advance past the 250ms delayed loader timeout
        await vi.advanceTimersByTimeAsync(300)
        await nextTick()

        // Loading state should NOT have been reset
        expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('should reset loading state when imageUrls prop changes to different URLs', async () => {
      vi.useFakeTimers()
      try {
        const urls = ['/api/view?filename=test.png&type=output']
        const wrapper = mountImagePreview({ imageUrls: urls })

        // Simulate image load completing
        const img = wrapper.find('img')
        await img.trigger('load')
        await nextTick()

        // Verify loader is hidden
        expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)

        // Change to different URL
        await wrapper.setProps({
          imageUrls: ['/api/view?filename=different.png&type=output']
        })
        await nextTick()

        // Advance past the 250ms delayed loader timeout
        await vi.advanceTimersByTimeAsync(300)
        await nextTick()

        expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('should handle empty to non-empty URL transitions correctly', async () => {
      const wrapper = mountImagePreview({ imageUrls: [] })

      expect(wrapper.find('.image-preview').exists()).toBe(false)

      await wrapper.setProps({
        imageUrls: ['/api/view?filename=test.png&type=output']
      })
      await nextTick()

      expect(wrapper.find('.image-preview').exists()).toBe(true)
      expect(wrapper.find('img').exists()).toBe(true)
    })
  })
})
