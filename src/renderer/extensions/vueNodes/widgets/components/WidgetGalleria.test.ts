import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetGalleria from './WidgetGalleria.vue'
import type { GalleryImage, GalleryValue } from './WidgetGalleria.vue'
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
        nextImage: 'Next image'
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
  return mount(WidgetGalleria, {
    global: {
      plugins: [i18n]
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

describe('WidgetGalleria Image Display', () => {
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

    it('handles null or undefined value gracefully', () => {
      const widget = createGalleriaWidget([])
      const wrapper = mountComponent(widget, [])

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

      const thumbnailButtons = wrapper.findAll('button.cursor-pointer')
      expect(thumbnailButtons).toHaveLength(3)
    })

    it('hides thumbnails for single image', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SINGLE])

      const thumbnailButtons = wrapper.findAll('button.cursor-pointer')
      expect(thumbnailButtons).toHaveLength(0)
    })

    it('respects widget option to hide thumbnails', () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL], {
        showThumbnails: false
      })

      const thumbnailButtons = wrapper.findAll('button.cursor-pointer')
      expect(thumbnailButtons).toHaveLength(0)
    })

    it('clicking thumbnail changes active image', async () => {
      const wrapper = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      const thumbnailButtons = wrapper.findAll('button.cursor-pointer')
      await thumbnailButtons[2].trigger('click')
      await nextTick()

      const mainImg = wrapper.findAll('img')[0]
      expect(mainImg.attributes('src')).toBe('https://example.com/image2.jpg')
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

  describe('Edge Cases', () => {
    it('handles empty array gracefully', () => {
      const wrapper = createGalleriaWrapper([])

      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.findAll('button.cursor-pointer')).toHaveLength(0)
    })

    it('handles malformed image objects', () => {
      const malformedImages = [{}, { randomProp: 'value' }, null, undefined]
      const wrapper = createGalleriaWrapper(malformedImages as string[])

      // Null/undefined filtered, 2 objects remain but render with empty src
      expect(wrapper.find('img').exists()).toBe(true)
    })

    it('handles very large image arrays', () => {
      const largeImageArray = createImageStrings(100)
      const wrapper = createGalleriaWrapper(largeImageArray)

      const thumbnailButtons = wrapper.findAll('button.cursor-pointer')
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

    it('handles invalid URL strings', () => {
      const invalidUrls = ['not-a-url', '', ' ', 'http://', 'ftp://invalid']
      const wrapper = createGalleriaWrapper(invalidUrls)

      // Should still render without crashing
      expect(wrapper.find('img').exists()).toBe(true)
    })
  })
})
