import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ImageCompare from 'primevue/imagecompare'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetImageCompare from './WidgetImageCompare.vue'
import type { ImageCompareValue } from './WidgetImageCompare.vue'

describe('WidgetImageCompare Display', () => {
  const createMockWidget = (
    value: ImageCompareValue | string,
    options: SimplifiedWidget['options'] = {}
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
    it('renders imagecompare component with proper structure and styling', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      // Component exists
      const imageCompare = wrapper.findComponent({ name: 'ImageCompare' })
      expect(imageCompare.exists()).toBe(true)

      // Renders both images with correct URLs
      const images = wrapper.findAll('img')
      expect(images).toHaveLength(2)
      expect(images[0].attributes('src')).toBe('https://example.com/before.jpg')
      expect(images[1].attributes('src')).toBe('https://example.com/after.jpg')

      // Images have proper styling classes
      images.forEach((img) => {
        expect(img.classes()).toContain('object-cover')
        expect(img.classes()).toContain('w-full')
        expect(img.classes()).toContain('h-full')
      })
    })
  })

  describe('Object Value Input', () => {
    it('handles alt text correctly - custom, default, and empty', () => {
      // Test custom alt text
      const customAltValue: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg',
        beforeAlt: 'Original design',
        afterAlt: 'Updated design'
      }
      const customWrapper = mountComponent(createMockWidget(customAltValue))
      const customImages = customWrapper.findAll('img')
      expect(customImages[0].attributes('alt')).toBe('Original design')
      expect(customImages[1].attributes('alt')).toBe('Updated design')

      // Test default alt text
      const defaultAltValue: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const defaultWrapper = mountComponent(createMockWidget(defaultAltValue))
      const defaultImages = defaultWrapper.findAll('img')
      expect(defaultImages[0].attributes('alt')).toBe('Before image')
      expect(defaultImages[1].attributes('alt')).toBe('After image')

      // Test empty string alt text (falls back to default)
      const emptyAltValue: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg',
        beforeAlt: '',
        afterAlt: ''
      }
      const emptyWrapper = mountComponent(createMockWidget(emptyAltValue))
      const emptyImages = emptyWrapper.findAll('img')
      expect(emptyImages[0].attributes('alt')).toBe('Before image')
      expect(emptyImages[1].attributes('alt')).toBe('After image')
    })

    it('handles missing and partial image URLs gracefully', () => {
      // Missing URLs
      const missingValue: ImageCompareValue = { before: '', after: '' }
      const missingWrapper = mountComponent(createMockWidget(missingValue))
      const missingImages = missingWrapper.findAll('img')
      expect(missingImages[0].attributes('src')).toBe('')
      expect(missingImages[1].attributes('src')).toBe('')

      // Partial URLs
      const partialValue: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: ''
      }
      const partialWrapper = mountComponent(createMockWidget(partialValue))
      const partialImages = partialWrapper.findAll('img')
      expect(partialImages[0].attributes('src')).toBe(
        'https://example.com/before.jpg'
      )
      expect(partialImages[1].attributes('src')).toBe('')
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
      const value: ImageCompareValue = {} as ImageCompareValue
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

    it('handles special content - long URLs, special characters, and long alt text', () => {
      // Test very long URLs
      const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '.jpg'
      const longUrlValue: ImageCompareValue = {
        before: longUrl,
        after: longUrl
      }
      const longUrlWrapper = mountComponent(createMockWidget(longUrlValue))
      const longUrlImages = longUrlWrapper.findAll('img')
      expect(longUrlImages[0].attributes('src')).toBe(longUrl)
      expect(longUrlImages[1].attributes('src')).toBe(longUrl)

      // Test special characters in URLs
      const specialUrl =
        'https://example.com/path with spaces & symbols!@#$.jpg'
      const specialUrlValue: ImageCompareValue = {
        before: specialUrl,
        after: specialUrl
      }
      const specialUrlWrapper = mountComponent(
        createMockWidget(specialUrlValue)
      )
      const specialUrlImages = specialUrlWrapper.findAll('img')
      expect(specialUrlImages[0].attributes('src')).toBe(specialUrl)
      expect(specialUrlImages[1].attributes('src')).toBe(specialUrl)

      // Test very long alt text
      const longAlt =
        'Very long alt text that exceeds normal length: ' +
        'description '.repeat(50)
      const longAltValue: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg',
        beforeAlt: longAlt,
        afterAlt: longAlt
      }
      const longAltWrapper = mountComponent(createMockWidget(longAltValue))
      const longAltImages = longAltWrapper.findAll('img')
      expect(longAltImages[0].attributes('alt')).toBe(longAlt)
      expect(longAltImages[1].attributes('alt')).toBe(longAlt)
    })
  })

  describe('Template Structure', () => {
    it('correctly assigns images to left and right template slots', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      // First image (before) should be in left template slot
      expect(images[0].attributes('src')).toBe('https://example.com/before.jpg')
      // Second image (after) should be in right template slot
      expect(images[1].attributes('src')).toBe('https://example.com/after.jpg')
    })
  })

  describe('Integration', () => {
    it('works with various URL types - data URLs and blob URLs', () => {
      // Test data URLs
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      const dataUrlValue: ImageCompareValue = {
        before: dataUrl,
        after: dataUrl
      }
      const dataUrlWrapper = mountComponent(createMockWidget(dataUrlValue))
      const dataUrlImages = dataUrlWrapper.findAll('img')
      expect(dataUrlImages[0].attributes('src')).toBe(dataUrl)
      expect(dataUrlImages[1].attributes('src')).toBe(dataUrl)

      // Test blob URLs
      const blobUrl =
        'blob:http://example.com/12345678-1234-1234-1234-123456789012'
      const blobUrlValue: ImageCompareValue = {
        before: blobUrl,
        after: blobUrl
      }
      const blobUrlWrapper = mountComponent(createMockWidget(blobUrlValue))
      const blobUrlImages = blobUrlWrapper.findAll('img')
      expect(blobUrlImages[0].attributes('src')).toBe(blobUrl)
      expect(blobUrlImages[1].attributes('src')).toBe(blobUrl)
    })
  })
})
