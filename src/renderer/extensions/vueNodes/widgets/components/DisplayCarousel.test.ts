import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import DisplayCarousel from './DisplayCarousel.vue'
import type { GalleryImage, GalleryValue } from './DisplayCarousel.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        galleryImage: 'Gallery image',
        galleryThumbnail: 'Gallery thumbnail',
        previousImage: 'Previous image',
        nextImage: 'Next image',
        switchToGridView: 'Switch to grid view',
        switchToSingleView: 'Switch to single view',
        viewImageOfTotal: 'View image {index} of {total}',
        editOrMaskImage: 'Edit or mask image',
        downloadImage: 'Download image',
        removeImage: 'Remove image'
      }
    }
  }
})

const TEST_IMAGES_SMALL: readonly string[] = Object.freeze([
  'https://example.com/image0.jpg',
  'https://example.com/image1.jpg',
  'https://example.com/image2.jpg'
])

const TEST_IMAGES_SINGLE: readonly string[] = Object.freeze([
  'https://example.com/single.jpg'
])

const TEST_IMAGE_OBJECTS: readonly GalleryImage[] = Object.freeze([
  {
    itemImageSrc: 'https://example.com/image0.jpg',
    thumbnailImageSrc: 'https://example.com/thumb0.jpg',
    alt: 'Test image 0'
  },
  {
    itemImageSrc: 'https://example.com/image1.jpg',
    thumbnailImageSrc: 'https://example.com/thumb1.jpg',
    alt: 'Test image 1'
  }
])

function createGalleriaWidget(
  value: GalleryValue = [],
  options: Record<string, unknown> = {}
) {
  return createMockWidget<GalleryValue>({
    value,
    name: 'test_galleria',
    type: 'array',
    options
  })
}

function mountComponent(
  widget: SimplifiedWidget<GalleryValue>,
  modelValue: GalleryValue
) {
  return mount(DisplayCarousel, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n]
    },
    props: {
      widget,
      modelValue
    }
  })
}

function createImageStrings(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `https://example.com/image${i}.jpg`
  )
}

function createGalleriaWrapper(
  images: GalleryValue,
  options: Record<string, unknown> = {}
) {
  const widget = createGalleriaWidget(images, options)
  return mountComponent(widget, images)
}

function findThumbnails(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('div').filter((div) => {
    return div.find('img').exists() && div.classes().includes('border-2')
  })
}

function findImageContainer(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('[tabindex="0"]')
}

describe('DisplayCarousel Single Mode', () => {
  describe('Component Rendering', () => {
    it('renders main image', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe(TEST_IMAGES_SMALL[0])
    })

    it('displays empty gallery when no images provided', () => {
      const wrapper = createGalleriaWrapper([])

      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('handles null value gracefully', () => {
      const widget = createGalleriaWidget([])
      const wrapper = mountComponent(
        widget,
        fromAny<GalleryValue, unknown>(null)
      )

      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('handles undefined value gracefully', () => {
      const widget = createGalleriaWidget([])
      const wrapper = mountComponent(
        widget,
        fromAny<GalleryValue, unknown>(undefined)
      )

      expect(wrapper.find('img').exists()).toBe(false)
    })
  })

  describe('String Array Input', () => {
    it('converts string array to image objects and displays first', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      const img = wrapper.find('img')
      expect(img.attributes('src')).toBe('https://example.com/image0.jpg')
    })

    it('handles single string image', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SINGLE])

      const img = wrapper.find('img')
      expect(img.attributes('src')).toBe('https://example.com/single.jpg')
    })
  })

  describe('Object Array Input', () => {
    it('preserves image objects and displays first', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGE_OBJECTS])

      const img = wrapper.find('img')
      expect(img.attributes('src')).toBe('https://example.com/image0.jpg')
      expect(img.attributes('alt')).toBe('Test image 0')
    })

    it('handles mixed object properties with src fallback', () => {
      const images: GalleryImage[] = [
        { src: 'https://example.com/image1.jpg', alt: 'First' }
      ]
      const wrapper = createGalleriaWrapper(images)

      const img = wrapper.find('img')
      expect(img.attributes('src')).toBe('https://example.com/image1.jpg')
    })
  })

  describe('Thumbnail Display', () => {
    it('shows thumbnails when multiple images present', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      const thumbnailButtons = findThumbnails(wrapper)
      expect(thumbnailButtons).toHaveLength(3)
    })

    it('hides thumbnails for single image', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SINGLE])

      const thumbnailButtons = findThumbnails(wrapper)
      expect(thumbnailButtons).toHaveLength(0)
    })

    it('thumbnails are not interactive', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      const thumbnails = findThumbnails(wrapper)
      expect(thumbnails[0].element.tagName).not.toBe('BUTTON')
    })
  })

  describe('Navigation Buttons', () => {
    it('shows navigation buttons when multiple images present', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      expect(wrapper.find('[aria-label="Previous image"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Next image"]').exists()).toBe(true)
    })

    it('hides navigation buttons for single image', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SINGLE])

      expect(wrapper.find('[aria-label="Previous image"]').exists()).toBe(false)
      expect(wrapper.find('[aria-label="Next image"]').exists()).toBe(false)
    })

    it('respects widget option to hide navigation buttons', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL], {
        showItemNavigators: false
      })

      expect(wrapper.find('[aria-label="Previous image"]').exists()).toBe(false)
    })

    it('navigates to next image on next click', async () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      await wrapper.find('[aria-label="Next image"]').trigger('click')
      await nextTick()

      const mainImg = wrapper.findAll('img')[0]
      expect(mainImg.attributes('src')).toBe('https://example.com/image1.jpg')
    })

    it('navigates to previous image on prev click', async () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      // Go to second image first
      await wrapper.find('[aria-label="Next image"]').trigger('click')
      await nextTick()

      // Go back
      await wrapper.find('[aria-label="Previous image"]').trigger('click')
      await nextTick()

      const mainImg = wrapper.findAll('img')[0]
      expect(mainImg.attributes('src')).toBe('https://example.com/image0.jpg')
    })

    it('wraps from first to last image on previous click', async () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      await wrapper.find('[aria-label="Previous image"]').trigger('click')
      await nextTick()

      const mainImg = wrapper.findAll('img')[0]
      expect(mainImg.attributes('src')).toBe('https://example.com/image2.jpg')
    })

    it('wraps from last to first image on next click', async () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      // Navigate to last image
      await wrapper.find('[aria-label="Next image"]').trigger('click')
      await wrapper.find('[aria-label="Next image"]').trigger('click')
      await nextTick()

      // Next from last should wrap to first
      await wrapper.find('[aria-label="Next image"]').trigger('click')
      await nextTick()

      const mainImg = wrapper.findAll('img')[0]
      expect(mainImg.attributes('src')).toBe('https://example.com/image0.jpg')
    })
  })
})

describe('DisplayCarousel Accessibility', () => {
  it('shows controls on focusin for keyboard users', async () => {
    const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

    await findImageContainer(wrapper).trigger('focusin')
    await nextTick()

    expect(wrapper.find('[aria-label="Switch to grid view"]').exists()).toBe(
      true
    )
    expect(wrapper.find('[aria-label="Edit or mask image"]').exists()).toBe(
      true
    )
  })

  it('hides controls on focusout when focus leaves component', async () => {
    const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

    await findImageContainer(wrapper).trigger('focusin')
    await nextTick()

    // Focus leaves the image container entirely
    await findImageContainer(wrapper).trigger('focusout', {
      relatedTarget: null
    })
    await nextTick()

    expect(wrapper.find('[aria-label="Switch to grid view"]').exists()).toBe(
      false
    )
  })
})

describe('DisplayCarousel Grid Mode', () => {
  it('switches to grid mode via toggle button on hover', async () => {
    const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

    // Trigger focus on image container to reveal toggle button
    await findImageContainer(wrapper).trigger('focusin')
    await nextTick()

    const toggleBtn = wrapper.find('[aria-label="Switch to grid view"]')
    expect(toggleBtn.exists()).toBe(true)

    await toggleBtn.trigger('click')
    await nextTick()

    // Grid mode should show all images as grid items
    const gridImages = wrapper.findAll('img')
    expect(gridImages).toHaveLength(TEST_IMAGES_SMALL.length)
  })

  it('does not show grid toggle for single image', async () => {
    const wrapper = createGalleriaWrapper([...TEST_IMAGES_SINGLE])

    await findImageContainer(wrapper).trigger('focusin')
    await nextTick()

    expect(wrapper.find('[aria-label="Switch to grid view"]').exists()).toBe(
      false
    )
  })

  it('switches back to single mode via toggle button', async () => {
    const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

    // Switch to grid via focus on image container
    await findImageContainer(wrapper).trigger('focusin')
    await nextTick()
    await wrapper.find('[aria-label="Switch to grid view"]').trigger('click')
    await nextTick()

    // Focus the grid container to reveal toggle
    await findImageContainer(wrapper).trigger('focusin')
    await nextTick()

    // Switch back to single
    const singleToggle = wrapper.find('[aria-label="Switch to single view"]')
    expect(singleToggle.exists()).toBe(true)

    await singleToggle.trigger('click')
    await nextTick()

    // Should be back in single mode with main image
    expect(wrapper.find('[aria-label="Previous image"]').exists()).toBe(true)
  })

  it('clicking grid image switches to single mode focused on that image', async () => {
    const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

    // Switch to grid via focus on image container
    await findImageContainer(wrapper).trigger('focusin')
    await nextTick()
    await wrapper.find('[aria-label="Switch to grid view"]').trigger('click')
    await nextTick()

    // Click second grid image
    const gridButtons = wrapper
      .findAll('button')
      .filter((btn) => btn.find('img').exists())
    await gridButtons[1].trigger('click')
    await nextTick()

    // Should be in single mode showing the second image
    const mainImg = wrapper.findAll('img')[0]
    expect(mainImg.attributes('src')).toBe('https://example.com/image1.jpg')
  })

  it('reverts to single mode when images reduce to one', async () => {
    const images = ref<GalleryValue>([...TEST_IMAGES_SMALL])
    const widget = createGalleriaWidget([...TEST_IMAGES_SMALL])
    const wrapper = mount(DisplayCarousel, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn }), i18n] },
      props: { widget, modelValue: images.value }
    })

    // Switch to grid via focus on image container
    await findImageContainer(wrapper).trigger('focusin')
    await nextTick()
    await wrapper.find('[aria-label="Switch to grid view"]').trigger('click')
    await nextTick()

    // Reduce to single image
    await wrapper.setProps({ modelValue: [TEST_IMAGES_SMALL[0]] })
    await nextTick()

    // Should revert to single mode (no grid toggle visible)
    expect(wrapper.find('[aria-label="Switch to single view"]').exists()).toBe(
      false
    )
  })
})

describe('DisplayCarousel Edge Cases', () => {
  it('handles empty array gracefully', () => {
    const wrapper = createGalleriaWrapper([])

    expect(wrapper.find('img').exists()).toBe(false)
    expect(findThumbnails(wrapper)).toHaveLength(0)
  })

  it('filters out malformed image objects without valid src', () => {
    const malformedImages = [{}, { randomProp: 'value' }, null, undefined]
    const wrapper = createGalleriaWrapper(malformedImages as string[])

    // All filtered out: null/undefined removed, then objects without src filtered
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('handles very large image arrays', () => {
    const largeImageArray = createImageStrings(100)
    const wrapper = createGalleriaWrapper(largeImageArray)

    const thumbnailButtons = findThumbnails(wrapper)
    expect(thumbnailButtons).toHaveLength(100)
  })

  it('handles mixed string and object arrays gracefully', () => {
    const mixedArray = [
      'https://example.com/string.jpg',
      { itemImageSrc: 'https://example.com/object.jpg' },
      'https://example.com/another-string.jpg'
    ]
    expect(() => createGalleriaWrapper(mixedArray as string[])).not.toThrow()
  })

  it('handles invalid URL strings without crashing', () => {
    const invalidUrls = ['not-a-url', 'http://', 'ftp://invalid']
    const wrapper = createGalleriaWrapper(invalidUrls)

    expect(wrapper.find('img').exists()).toBe(true)
  })

  it('filters out empty string URLs', () => {
    const wrapper = createGalleriaWrapper([''])
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
