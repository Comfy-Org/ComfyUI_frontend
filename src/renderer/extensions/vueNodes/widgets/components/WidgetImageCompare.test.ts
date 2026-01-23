import { mount } from '@vue/test-utils'
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
        mocks: {
          $t: (key: string) => key
        }
      },
      props: {
        widget,
        readonly
      }
    })
  }

  describe('Component Rendering', () => {
    it('renders with proper structure and styling when images are provided', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images).toHaveLength(2)

      // In the new implementation: after image is first (background), before image is second (overlay)
      expect(images[0].attributes('src')).toBe('https://example.com/after.jpg')
      expect(images[1].attributes('src')).toBe('https://example.com/before.jpg')

      images.forEach((img) => {
        expect(img.classes()).toContain('object-contain')
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
      // DOM order: [after, before]
      expect(customImages[0].attributes('alt')).toBe('Updated design')
      expect(customImages[1].attributes('alt')).toBe('Original design')

      // Test default alt text
      const defaultAltValue: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const defaultWrapper = mountComponent(createMockWidget(defaultAltValue))
      const defaultImages = defaultWrapper.findAll('img')
      expect(defaultImages[0].attributes('alt')).toBe('After image')
      expect(defaultImages[1].attributes('alt')).toBe('Before image')

      // Test empty string alt text (falls back to default)
      const emptyAltValue: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg',
        beforeAlt: '',
        afterAlt: ''
      }
      const emptyWrapper = mountComponent(createMockWidget(emptyAltValue))
      const emptyImages = emptyWrapper.findAll('img')
      expect(emptyImages[0].attributes('alt')).toBe('After image')
      expect(emptyImages[1].attributes('alt')).toBe('Before image')
    })

    it('handles partial image URLs gracefully', () => {
      // Only before image provided
      const beforeOnlyValue: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: ''
      }
      const beforeOnlyWrapper = mountComponent(
        createMockWidget(beforeOnlyValue)
      )
      const beforeOnlyImages = beforeOnlyWrapper.findAll('img')
      expect(beforeOnlyImages).toHaveLength(1)
      expect(beforeOnlyImages[0].attributes('src')).toBe(
        'https://example.com/before.jpg'
      )

      // Only after image provided
      const afterOnlyValue: ImageCompareValue = {
        before: '',
        after: 'https://example.com/after.jpg'
      }
      const afterOnlyWrapper = mountComponent(createMockWidget(afterOnlyValue))
      const afterOnlyImages = afterOnlyWrapper.findAll('img')
      expect(afterOnlyImages).toHaveLength(1)
      expect(afterOnlyImages[0].attributes('src')).toBe(
        'https://example.com/after.jpg'
      )
    })
  })

  describe('String Value Input', () => {
    it('handles string value as before image only', () => {
      const value = 'https://example.com/single.jpg'
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images).toHaveLength(1)
      expect(images[0].attributes('src')).toBe('https://example.com/single.jpg')
      expect(images[0].attributes('alt')).toBe('Before image')
    })
  })

  describe('Readonly Mode', () => {
    it('renders normally in readonly mode', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget, true)

      const images = wrapper.findAll('img')
      expect(images).toHaveLength(2)
    })
  })

  describe('Edge Cases', () => {
    it('shows no images message when widget value is empty string', () => {
      const widget = createMockWidget('')
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images).toHaveLength(0)
      expect(wrapper.text()).toContain('imageCompare.noImages')
    })

    it('shows no images message when both URLs are empty', () => {
      const value: ImageCompareValue = { before: '', after: '' }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images).toHaveLength(0)
      expect(wrapper.text()).toContain('imageCompare.noImages')
    })

    it('shows no images message for empty object value', () => {
      const value: ImageCompareValue = {} as ImageCompareValue
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      expect(images).toHaveLength(0)
      expect(wrapper.text()).toContain('imageCompare.noImages')
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
    it('correctly renders after image as background and before image as overlay', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const images = wrapper.findAll('img')
      // After image is rendered first as background
      expect(images[0].attributes('src')).toBe('https://example.com/after.jpg')
      // Before image is rendered second as overlay with clipPath
      expect(images[1].attributes('src')).toBe('https://example.com/before.jpg')
      expect(images[1].classes()).toContain('absolute')
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

  describe('Slider Element', () => {
    it('renders slider divider when images are present', () => {
      const value: ImageCompareValue = {
        before: 'https://example.com/before.jpg',
        after: 'https://example.com/after.jpg'
      }
      const widget = createMockWidget(value)
      const wrapper = mountComponent(widget)

      const slider = wrapper.find('[role="presentation"]')
      expect(slider.exists()).toBe(true)
      expect(slider.classes()).toContain('bg-white')
    })

    it('does not render slider when no images', () => {
      const widget = createMockWidget('')
      const wrapper = mountComponent(widget)

      const slider = wrapper.find('[role="presentation"]')
      expect(slider.exists()).toBe(false)
    })
  })
})
