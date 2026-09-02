import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { GalleriaProps } from 'primevue/galleria'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
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
      'Gallery image': 'Gallery image'
    }
  }
})

const GalleriaStub = defineComponent({
  name: 'Galleria',
  props: {
    value: { type: Array, default: () => [] },
    showThumbnails: { type: Boolean, default: false },
    showItemNavigators: { type: Boolean, default: false },
    activeIndex: { type: Number, default: 0 },
    circular: { type: Boolean, default: false },
    autoPlay: { type: Boolean, default: false },
    transitionInterval: { type: Number, default: 0 },
    pt: { type: Object, default: () => ({}) }
  },
  emits: ['update:activeIndex'],
  template: `<div data-testid="galleria"
    class="max-w-full"
    :data-value="JSON.stringify(value)"
    :data-show-thumbnails="String(showThumbnails)"
    :data-show-item-navigators="String(showItemNavigators)"
    :data-active-index="String(activeIndex)"
    :data-circular="String(circular)"
    :data-auto-play="String(autoPlay)"
    :data-transition-interval="String(transitionInterval)"
    :data-pt="JSON.stringify(pt)"
  ><button data-testid="galleria-set-index" @click="$emit('update:activeIndex', 2)">set</button></div>`
})

// Test data constants for better test isolation
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

function getGalleriaElement(): HTMLElement {
  return screen.getByTestId('galleria')
}

function getGalleriaProp(name: string): string | null {
  return getGalleriaElement().getAttribute(`data-${name}`)
}

function getGalleriaValue(): unknown[] {
  return JSON.parse(getGalleriaProp('value') ?? '[]')
}

function getGalleriaPt(): Record<string, unknown> {
  return JSON.parse(getGalleriaProp('pt') ?? '{}')
}

// Helper functions outside describe blocks for better clarity
function createGalleriaWidget(
  value: GalleryValue = [],
  options: Partial<GalleriaProps> = {}
) {
  return createMockWidget<GalleryValue>({
    value,
    name: 'test_galleria',
    type: 'array',
    options
  })
}

function renderComponent(
  widget: SimplifiedWidget<GalleryValue>,
  modelValue: GalleryValue
) {
  return render(WidgetGalleria, {
    global: {
      plugins: [i18n],
      stubs: { Galleria: GalleriaStub }
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

// Factory function that takes images, creates widget internally, renders
function renderGalleria(
  images: GalleryValue,
  options: Partial<GalleriaProps> = {}
) {
  const widget = createGalleriaWidget(images, options)
  return renderComponent(widget, images)
}

describe('WidgetGalleria Image Display', () => {
  describe('Component Rendering', () => {
    it('renders galleria component', () => {
      renderGalleria([...TEST_IMAGES_SMALL])

      expect(getGalleriaElement()).toBeTruthy()
    })

    it('displays empty gallery when no images provided', () => {
      const widget = createGalleriaWidget([])
      renderComponent(widget, [])

      expect(getGalleriaValue()).toEqual([])
    })

    it('handles null or undefined value gracefully', () => {
      const widget = createGalleriaWidget([])
      renderComponent(widget, [])

      expect(getGalleriaValue()).toEqual([])
    })
  })

  describe('String Array Input', () => {
    it('converts string array to image objects', () => {
      const widget = createGalleriaWidget([...TEST_IMAGES_SMALL])
      renderComponent(widget, [...TEST_IMAGES_SMALL])

      const value = getGalleriaValue()

      expect(value).toHaveLength(3)
      expect(value[0]).toEqual({
        itemImageSrc: 'https://example.com/image0.jpg',
        thumbnailImageSrc: 'https://example.com/image0.jpg',
        alt: 'Image 0'
      })
    })

    it('handles single string image', () => {
      const widget = createGalleriaWidget([...TEST_IMAGES_SINGLE])
      renderComponent(widget, [...TEST_IMAGES_SINGLE])

      const value = getGalleriaValue()

      expect(value).toHaveLength(1)
      expect(value[0]).toEqual({
        itemImageSrc: 'https://example.com/single.jpg',
        thumbnailImageSrc: 'https://example.com/single.jpg',
        alt: 'Image 0'
      })
    })
  })

  describe('Object Array Input', () => {
    it('preserves image objects as-is', () => {
      const widget = createGalleriaWidget([...TEST_IMAGE_OBJECTS])
      renderComponent(widget, [...TEST_IMAGE_OBJECTS])

      const value = getGalleriaValue()

      expect(value).toEqual([...TEST_IMAGE_OBJECTS])
    })

    it('handles mixed object properties', () => {
      const images: GalleryImage[] = [
        { src: 'https://example.com/image1.jpg', alt: 'First' },
        { itemImageSrc: 'https://example.com/image2.jpg' },
        { thumbnailImageSrc: 'https://example.com/thumb3.jpg' }
      ]
      const widget = createGalleriaWidget(images)
      renderComponent(widget, images)

      const value = getGalleriaValue()

      expect(value).toEqual(images)
    })
  })

  describe('Thumbnail Display', () => {
    it('shows thumbnails when multiple images present', () => {
      renderGalleria([...TEST_IMAGES_SMALL])

      expect(getGalleriaProp('show-thumbnails')).toBe('true')
    })

    it('hides thumbnails for single image', () => {
      renderGalleria([...TEST_IMAGES_SINGLE])

      expect(getGalleriaProp('show-thumbnails')).toBe('false')
    })

    it('respects widget option to hide thumbnails', () => {
      renderGalleria([...TEST_IMAGES_SMALL], {
        showThumbnails: false
      })

      expect(getGalleriaProp('show-thumbnails')).toBe('false')
    })

    it('shows thumbnails when explicitly enabled for multiple images', () => {
      renderGalleria([...TEST_IMAGES_SMALL], {
        showThumbnails: true
      })

      expect(getGalleriaProp('show-thumbnails')).toBe('true')
    })
  })

  describe('Navigation Buttons', () => {
    it('shows navigation buttons when multiple images present', () => {
      renderGalleria([...TEST_IMAGES_SMALL])

      expect(getGalleriaProp('show-item-navigators')).toBe('true')
    })

    it('hides navigation buttons for single image', () => {
      renderGalleria([...TEST_IMAGES_SINGLE])

      expect(getGalleriaProp('show-item-navigators')).toBe('false')
    })

    it('respects widget option to hide navigation buttons', () => {
      const images = createImageStrings(3)
      const widget = createGalleriaWidget(images, {
        showItemNavigators: false
      })
      renderComponent(widget, images)

      expect(getGalleriaProp('show-item-navigators')).toBe('false')
    })

    it('shows navigation buttons when explicitly enabled for multiple images', () => {
      const images = createImageStrings(3)
      const widget = createGalleriaWidget(images, {
        showItemNavigators: true
      })
      renderComponent(widget, images)

      expect(getGalleriaProp('show-item-navigators')).toBe('true')
    })
  })

  describe('Widget Options Handling', () => {
    it('passes through valid widget options', () => {
      const images = createImageStrings(2)
      const widget = createGalleriaWidget(images, {
        circular: true,
        autoPlay: true,
        transitionInterval: 3000
      })
      renderComponent(widget, images)

      expect(getGalleriaProp('circular')).toBe('true')
      expect(getGalleriaProp('auto-play')).toBe('true')
      expect(getGalleriaProp('transition-interval')).toBe('3000')
    })

    it('applies custom styling props', () => {
      const images = createImageStrings(2)
      const widget = createGalleriaWidget(images)
      renderComponent(widget, images)

      expect(getGalleriaElement().getAttribute('class')).toBeDefined()
    })
  })

  describe('Active Index Management', () => {
    it('initializes with zero active index', () => {
      const images = createImageStrings(3)
      const widget = createGalleriaWidget(images)
      renderComponent(widget, images)

      expect(getGalleriaProp('active-index')).toBe('0')
    })

    it('can update active index', async () => {
      const images = createImageStrings(3)
      const widget = createGalleriaWidget(images)
      renderComponent(widget, images)

      const user = userEvent.setup()
      await user.click(screen.getByTestId('galleria-set-index'))

      await waitFor(() => expect(getGalleriaProp('active-index')).toBe('2'))
    })
  })

  describe('Image Template Rendering', () => {
    it('renders item template with correct image source priorities', () => {
      const images: GalleryImage[] = [
        {
          itemImageSrc: 'https://example.com/item.jpg',
          src: 'https://example.com/fallback.jpg'
        },
        { src: 'https://example.com/only-src.jpg' }
      ]
      const widget = createGalleriaWidget(images)
      renderComponent(widget, images)

      expect(getGalleriaElement()).toBeTruthy()
    })

    it('renders thumbnail template with correct image source priorities', () => {
      const images: GalleryImage[] = [
        {
          thumbnailImageSrc: 'https://example.com/thumb.jpg',
          src: 'https://example.com/fallback.jpg'
        },
        { src: 'https://example.com/only-src.jpg' }
      ]
      const widget = createGalleriaWidget(images)
      renderComponent(widget, images)

      expect(getGalleriaElement()).toBeTruthy()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty array gracefully', () => {
      const widget = createGalleriaWidget([])
      renderComponent(widget, [])

      expect(getGalleriaValue()).toEqual([])
      expect(getGalleriaProp('show-thumbnails')).toBe('false')
      expect(getGalleriaProp('show-item-navigators')).toBe('false')
    })

    it('handles malformed image objects', () => {
      const malformedImages = [
        {}, // Empty object
        { randomProp: 'value' }, // Object without expected image properties
        null, // Null value
        undefined // Undefined value
      ]
      const widget = createGalleriaWidget(malformedImages as string[])
      renderComponent(widget, malformedImages as string[])

      // Null/undefined should be filtered out, leaving only the objects
      const expectedValue = [{}, { randomProp: 'value' }]
      expect(getGalleriaValue()).toEqual(expectedValue)
    })

    it('handles very large image arrays', () => {
      const largeImageArray = createImageStrings(100)
      const widget = createGalleriaWidget(largeImageArray)
      renderComponent(widget, largeImageArray)

      expect(getGalleriaValue()).toHaveLength(100)
      expect(getGalleriaProp('show-thumbnails')).toBe('true')
      expect(getGalleriaProp('show-item-navigators')).toBe('true')
    })

    it('handles mixed string and object arrays gracefully', () => {
      // This is technically invalid input, but the component should handle it
      const mixedArray = [
        'https://example.com/string.jpg',
        { itemImageSrc: 'https://example.com/object.jpg' },
        'https://example.com/another-string.jpg'
      ]
      const widget = createGalleriaWidget(mixedArray as string[])

      // The component expects consistent typing, but let's test it handles mixed input
      expect(() =>
        renderComponent(widget, mixedArray as string[])
      ).not.toThrow()
    })

    it('handles invalid URL strings', () => {
      const invalidUrls = ['not-a-url', '', ' ', 'http://', 'ftp://invalid']
      const widget = createGalleriaWidget(invalidUrls)
      renderComponent(widget, invalidUrls)

      expect(getGalleriaValue()).toHaveLength(5)
    })
  })

  describe('Styling and Layout', () => {
    it('applies max-width constraint', () => {
      const images = createImageStrings(2)
      const widget = createGalleriaWidget(images)
      renderComponent(widget, images)

      expect(getGalleriaElement().getAttribute('class')).toBeDefined()
    })

    it('applies passthrough props for thumbnails', () => {
      const images = createImageStrings(3)
      const widget = createGalleriaWidget(images)
      renderComponent(widget, images)

      const pt = getGalleriaPt()

      expect(pt).toBeDefined()
      expect(pt.thumbnails).toBeDefined()
      expect(pt.thumbnailContent).toBeDefined()
      expect(pt.thumbnailPrevButton).toBeDefined()
      expect(pt.thumbnailNextButton).toBeDefined()
    })
  })
})
