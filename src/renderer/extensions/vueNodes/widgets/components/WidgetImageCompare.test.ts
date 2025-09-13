import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ImageCompare from 'primevue/imagecompare'
import type { ImageCompareProps } from 'primevue/imagecompare'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetImageCompare from './WidgetImageCompare.vue'

interface ImageCompareValue {
  before: string
  after: string
  beforeAlt?: string
  afterAlt?: string
  initialPosition?: number
}

describe('WidgetImageCompare Display', () => {
  const createMockWidget = (
    value: ImageCompareValue | string,
    options: Partial<ImageCompareProps> = {}
  ): SimplifiedWidget<ImageCompareValue | string> => ({
    name: 'test_imagecompare',
    type: 'object',
    value,
    options
  })

  const mountComponent = (
    widget: SimplifiedWidget<ImageCompareValue | string>,
    readonly = false
  ) => {
    return mount(WidgetImageCompare, {
      global: {
        plugins: [PrimeVue],
        components: { ImageCompare }
      },
      props: {
        widget,
        readonly
      }
    })
  }

  describe('Component Rendering', () => {
    it('renders imagecompare component', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const imageCompare = wrapper.findComponent({ name: 'ImageCompare' })
      expect(imageCompare.exists()).toBe(true)
    })

    it('renders both before and after images', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images).toHaveLength(2)
      expect(images[0].attributes('src')).toBe('https://example.com/before.jpg')
      expect(images[1].attributes('src')).toBe('https://example.com/after.jpg')
    })

    it('applies object-cover class to images', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      images.forEach((img) => {
        expect(img.classes()).toContain('object-cover')
        expect(img.classes()).toContain('w-full')
        expect(img.classes()).toContain('h-full')
      })
    })
  })

  describe('Object Value Input', () => {
    it('displays before and after images from object value', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/original.jpg',
        after: 'https://example.com/modified.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe(
        'https://example.com/original.jpg'
      )
      expect(images[1].attributes('src')).toBe(
        'https://example.com/modified.jpg'
      )
    })

    it('uses custom alt text when provided', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg',
        beforeAlt: 'Original design',
        afterAlt: 'Updated design'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('alt')).toBe('Original design')
      expect(images[1].attributes('alt')).toBe('Updated design')
    })

    it('uses default alt text when not provided', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('alt')).toBe('Before image')
      expect(images[1].attributes('alt')).toBe('After image')
    })

    it('handles missing image URLs gracefully', () => {
      const value: ImageCompareValue = {
        before: '',
        after: ''
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe('')
      expect(images[1].attributes('src')).toBe('')
    })

    it('handles partial image URLs', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: ''
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe('https://example.com/before.jpg')
      expect(images[1].attributes('src')).toBe('')
    })
  })

  describe('String Value Input', () => {
    it('handles string value as before image only', () => {
      const value = 'https://example.com/single.jpg'
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe('https://example.com/single.jpg')
      expect(images[1].attributes('src')).toBe('')
    })

    it('uses default alt text for string values', () => {
      const value = 'https://example.com/single.jpg'
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('alt')).toBe('Before image')
      expect(images[1].attributes('alt')).toBe('After image')
    })
  })

  describe('Widget Options Handling', () => {
    it('passes through accessibility options', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value, {
        tabindex: 1,
        ariaLabel: 'Compare images',
        ariaLabelledby: 'compare-label'
      })
      const wrapper = mountComponent(widget)

      const imageCompare = wrapper.findComponent({ name: 'ImageCompare' })
      expect(imageCompare.props('tabindex')).toBe(1)
      expect(imageCompare.props('ariaLabel')).toBe('Compare images')
      expect(imageCompare.props('ariaLabelledby')).toBe('compare-label')
    })

    it('uses default tabindex when not provided', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const imageCompare = wrapper.findComponent({ name: 'ImageCompare' })
      expect(imageCompare.props('tabindex')).toBe(0)
    })

    it('passes through PrimeVue specific options', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value, {
        unstyled: true,
        pt: { root: { class: 'custom-class' } },
        ptOptions: { mergeSections: true }
      })
      const wrapper = mountComponent(widget)

      const imageCompare = wrapper.findComponent({ name: 'ImageCompare' })
      expect(imageCompare.props('unstyled')).toBe(true)
      expect(imageCompare.props('pt')).toEqual({
        root: { class: 'custom-class' }
      })
      expect(imageCompare.props('ptOptions')).toEqual({ mergeSections: true })
    })
  })

  describe('Readonly Mode', () => {
    it('renders normally in readonly mode (no interaction restrictions)', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget, true)

      // ImageCompare is display-only, readonly doesn't affect rendering
      const imageCompare = wrapper.findComponent({ name: 'ImageCompare' })
      expect(imageCompare.exists()).toBe(true)

      const images = wrapper.findAll('img')
      expect(images).toHaveLength(2)
    })
  })

  describe('Edge Cases', () => {
    it('handles null or undefined widget value', () => {
      const widget = createMockWidget('')
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe('')
      expect(images[1].attributes('src')).toBe('')
      expect(images[0].attributes('alt')).toBe('Before image')
      expect(images[1].attributes('alt')).toBe('After image')
    })

    it('handles empty object value', () => {
      const value = {} as ImageCompareValue
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe('')
      expect(images[1].attributes('src')).toBe('')
    })

    it('handles malformed object value', () => {
      const value = { randomProp: 'test', before: '', after: '' }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe('')
      expect(images[1].attributes('src')).toBe('')
    })

    it('handles very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '.jpg'
      const value: ImageCompareValue = {
        before: longUrl,
        after: longUrl
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe(longUrl)
      expect(images[1].attributes('src')).toBe(longUrl)
    })

    it('handles special characters in URLs', () => {
      const specialUrl =
        'https://example.com/path with spaces & symbols!@#$.jpg'
      const value: ImageCompareValue = {
        before: specialUrl,
        after: specialUrl
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe(specialUrl)
      expect(images[1].attributes('src')).toBe(specialUrl)
    })

    it('handles very long alt text', () => {
      const longAlt =
        'Very long alt text that exceeds normal length: ' +
        'description '.repeat(50)
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg',
        beforeAlt: longAlt,
        afterAlt: longAlt
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('alt')).toBe(longAlt)
      expect(images[1].attributes('alt')).toBe(longAlt)
    })

    it('handles empty string alt text', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg',
        beforeAlt: '',
        afterAlt: ''
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      // Empty strings should be falsy and fall back to defaults
      expect(images[0].attributes('alt')).toBe('Before image')
      expect(images[1].attributes('alt')).toBe('After image')
    })
  })

  describe('Template Structure', () => {
    it('uses left template for before image', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      // The first image should be in the left template slot
      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe('https://example.com/before.jpg')
    })

    it('uses right template for after image', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      // The second image should be in the right template slot
      const images = wrapper.findAll('img')
      expect(images[1].attributes('src')).toBe('https://example.com/after.jpg')
    })
  })

  describe('Integration', () => {
    it('works with data URLs', () => {
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      const value: ImageCompareValue = {
        before: dataUrl,
        after: dataUrl
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe(dataUrl)
      expect(images[1].attributes('src')).toBe(dataUrl)
    })

    it('works with blob URLs', () => {
      const blobUrl =
        'blob:http://example.com/12345678-1234-1234-1234-123456789012'
      const value: ImageCompareValue = {
        before: blobUrl,
        after: blobUrl
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images[0].attributes('src')).toBe(blobUrl)
      expect(images[1].attributes('src')).toBe(blobUrl)
    })
  })
})
