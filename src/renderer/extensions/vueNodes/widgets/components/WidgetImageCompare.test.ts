import { describe, expect, it } from 'vitest'

import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetImageCompare from './WidgetImageCompare.vue'
import type { ImageCompareValue } from './WidgetImageCompare.vue'
import { createMockWidget } from './widgetTestUtils'

describe('WidgetImageCompare Display', () => {
  const createImageCompareWidget = (
    value: ImageCompareValue | string,
    options: SimplifiedWidget<ImageCompareValue | string>['options'] = {}
  ) =>
    createMockWidget<ImageCompareValue | string>({
      value,
      name: 'test_imagecompare',
      type: 'object',
      options
    })

  function renderComponent(
    widget: SimplifiedWidget<ImageCompareValue | string>
  ) {
    return render(WidgetImageCompare, {
      global: {
        mocks: {
          $t: (key: string, params?: Record<string, unknown>) => {
            if (key === 'batch.index' && params) {
              return `${params.current} / ${params.total}`
            }
            return key
          }
        }
      },
      props: {
        widget
      }
    })
  }

  describe('Component Rendering', () => {
    it('renders with proper structure and styling when images are provided', () => {
      const value: ImageCompareValue = {
        beforeImages: ['https://example.com/before.jpg'],
        afterImages: ['https://example.com/after.jpg']
      }
      const widget = createImageCompareWidget(value)
      renderComponent(widget)

      const images = screen.getAllByRole('img')
      expect(images).toHaveLength(2)

      // After image is first (background), before image is second (overlay)
      expect(images[0]).toHaveAttribute('src', 'https://example.com/after.jpg')
      expect(images[1]).toHaveAttribute('src', 'https://example.com/before.jpg')

      images.forEach((img) => {
        expect(img).toHaveClass('object-contain')
      })
    })
  })

  describe('Object Value Input', () => {
    it('handles alt text correctly - custom, default, and empty', () => {
      // Test custom alt text
      const customAltValue: ImageCompareValue = {
        beforeImages: ['https://example.com/before.jpg'],
        afterImages: ['https://example.com/after.jpg'],
        beforeAlt: 'Original design',
        afterAlt: 'Updated design'
      }
      renderComponent(createImageCompareWidget(customAltValue))
      const customImages = screen.getAllByRole('img')
      // DOM order: [after, before]
      expect(customImages[0]).toHaveAttribute('alt', 'Updated design')
      expect(customImages[1]).toHaveAttribute('alt', 'Original design')
    })

    it('handles default alt text', () => {
      const defaultAltValue: ImageCompareValue = {
        beforeImages: ['https://example.com/before.jpg'],
        afterImages: ['https://example.com/after.jpg']
      }
      renderComponent(createImageCompareWidget(defaultAltValue))
      const defaultImages = screen.getAllByRole('img')
      expect(defaultImages[0]).toHaveAttribute('alt', 'After image')
      expect(defaultImages[1]).toHaveAttribute('alt', 'Before image')
    })

    it('handles empty string alt text (falls back to default)', () => {
      const emptyAltValue: ImageCompareValue = {
        beforeImages: ['https://example.com/before.jpg'],
        afterImages: ['https://example.com/after.jpg'],
        beforeAlt: '',
        afterAlt: ''
      }
      renderComponent(createImageCompareWidget(emptyAltValue))
      const emptyImages = screen.getAllByRole('img')
      expect(emptyImages[0]).toHaveAttribute('alt', 'After image')
      expect(emptyImages[1]).toHaveAttribute('alt', 'Before image')
    })

    it('handles partial image URLs gracefully', () => {
      // Only before image provided
      renderComponent(
        createImageCompareWidget({
          beforeImages: ['https://example.com/before.jpg']
        })
      )
      const beforeOnlyImages = screen.getAllByRole('img')
      expect(beforeOnlyImages).toHaveLength(1)
      expect(beforeOnlyImages[0]).toHaveAttribute(
        'src',
        'https://example.com/before.jpg'
      )
    })

    it('handles only after image provided', () => {
      renderComponent(
        createImageCompareWidget({
          afterImages: ['https://example.com/after.jpg']
        })
      )
      const afterOnlyImages = screen.getAllByRole('img')
      expect(afterOnlyImages).toHaveLength(1)
      expect(afterOnlyImages[0]).toHaveAttribute(
        'src',
        'https://example.com/after.jpg'
      )
    })
  })

  describe('String Value Input', () => {
    it('handles string value as before image only', () => {
      const value = 'https://example.com/single.jpg'
      const widget = createImageCompareWidget(value)
      renderComponent(widget)

      const images = screen.getAllByRole('img')
      expect(images).toHaveLength(1)
      expect(images[0]).toHaveAttribute('src', 'https://example.com/single.jpg')
      expect(images[0]).toHaveAttribute('alt', 'Before image')
    })
  })

  describe('Readonly Mode', () => {
    it('renders normally in readonly mode', () => {
      const value: ImageCompareValue = {
        beforeImages: ['https://example.com/before.jpg'],
        afterImages: ['https://example.com/after.jpg']
      }
      const widget = createImageCompareWidget(value)
      renderComponent(widget)

      const images = screen.getAllByRole('img')
      expect(images).toHaveLength(2)
    })
  })

  describe('Edge Cases', () => {
    it('shows no images message when widget value is empty string', () => {
      const widget = createImageCompareWidget('')
      renderComponent(widget)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.getByText('imageCompare.noImages')).toBeInTheDocument()
    })

    it('shows no images message when both arrays are empty', () => {
      const value: ImageCompareValue = {
        beforeImages: [],
        afterImages: []
      }
      const widget = createImageCompareWidget(value)
      renderComponent(widget)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.getByText('imageCompare.noImages')).toBeInTheDocument()
    })

    it('shows no images message for empty object value', () => {
      const value: ImageCompareValue = {} as ImageCompareValue
      const widget = createImageCompareWidget(value)
      renderComponent(widget)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.getByText('imageCompare.noImages')).toBeInTheDocument()
    })

    it('handles special content - long URLs, special characters, and long alt text', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '.jpg'
      renderComponent(
        createImageCompareWidget({
          beforeImages: [longUrl],
          afterImages: [longUrl]
        })
      )
      const longUrlImages = screen.getAllByRole('img')
      expect(longUrlImages[0]).toHaveAttribute('src', longUrl)
      expect(longUrlImages[1]).toHaveAttribute('src', longUrl)
    })

    it('handles special characters in URLs', () => {
      const specialUrl =
        'https://example.com/path with spaces & symbols!@#$.jpg'
      renderComponent(
        createImageCompareWidget({
          beforeImages: [specialUrl],
          afterImages: [specialUrl]
        })
      )
      const specialUrlImages = screen.getAllByRole('img')
      expect(specialUrlImages[0]).toHaveAttribute('src', specialUrl)
      expect(specialUrlImages[1]).toHaveAttribute('src', specialUrl)
    })

    it('handles long alt text', () => {
      const longAlt =
        'Very long alt text that exceeds normal length: ' +
        'description '.repeat(50)
      renderComponent(
        createImageCompareWidget({
          beforeImages: ['https://example.com/before.jpg'],
          afterImages: ['https://example.com/after.jpg'],
          beforeAlt: longAlt,
          afterAlt: longAlt
        })
      )
      const longAltImages = screen.getAllByRole('img')
      expect(longAltImages[0]).toHaveAttribute('alt', longAlt)
      expect(longAltImages[1]).toHaveAttribute('alt', longAlt)
    })
  })

  describe('Template Structure', () => {
    it('correctly renders after image as background and before image as overlay', () => {
      const value: ImageCompareValue = {
        beforeImages: ['https://example.com/before.jpg'],
        afterImages: ['https://example.com/after.jpg']
      }
      const widget = createImageCompareWidget(value)
      renderComponent(widget)

      const images = screen.getAllByRole('img')
      expect(images[0]).toHaveAttribute('src', 'https://example.com/after.jpg')
      expect(images[1]).toHaveAttribute('src', 'https://example.com/before.jpg')
      expect(images[1]).toHaveClass('absolute')
    })
  })

  describe('Integration', () => {
    it('works with various URL types - data URLs and blob URLs', () => {
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      renderComponent(
        createImageCompareWidget({
          beforeImages: [dataUrl],
          afterImages: [dataUrl]
        })
      )
      const dataUrlImages = screen.getAllByRole('img')
      expect(dataUrlImages[0]).toHaveAttribute('src', dataUrl)
      expect(dataUrlImages[1]).toHaveAttribute('src', dataUrl)
    })

    it('works with blob URLs', () => {
      const blobUrl =
        'blob:http://example.com/12345678-1234-1234-1234-123456789012'
      renderComponent(
        createImageCompareWidget({
          beforeImages: [blobUrl],
          afterImages: [blobUrl]
        })
      )
      const blobUrlImages = screen.getAllByRole('img')
      expect(blobUrlImages[0]).toHaveAttribute('src', blobUrl)
      expect(blobUrlImages[1]).toHaveAttribute('src', blobUrl)
    })
  })

  describe('Slider Element', () => {
    it('renders slider divider when images are present', () => {
      const value: ImageCompareValue = {
        beforeImages: ['https://example.com/before.jpg'],
        afterImages: ['https://example.com/after.jpg']
      }
      const widget = createImageCompareWidget(value)
      renderComponent(widget)

      expect(screen.getByRole('presentation')).toBeInTheDocument()
    })

    it('does not render slider when no images', () => {
      const widget = createImageCompareWidget('')
      renderComponent(widget)

      expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
    })
  })

  describe('Batch Navigation', () => {
    const beforeImages = [
      'https://example.com/a1.jpg',
      'https://example.com/a2.jpg',
      'https://example.com/a3.jpg'
    ]
    const afterImages = [
      'https://example.com/b1.jpg',
      'https://example.com/b2.jpg'
    ]

    it('shows batch nav when either side has multiple images', () => {
      const value: ImageCompareValue = { beforeImages, afterImages }
      renderComponent(createImageCompareWidget(value))

      expect(screen.getByTestId('batch-nav')).toBeInTheDocument()
      expect(
        within(screen.getByTestId('before-batch')).getByTestId('batch-counter')
      ).toHaveTextContent('1 / 3')
      expect(
        within(screen.getByTestId('after-batch')).getByTestId('batch-counter')
      ).toHaveTextContent('1 / 2')
    })

    it('hides batch nav for single images', () => {
      const value: ImageCompareValue = {
        beforeImages: ['https://example.com/a1.jpg'],
        afterImages: ['https://example.com/b1.jpg']
      }
      renderComponent(createImageCompareWidget(value))

      expect(screen.queryByTestId('batch-nav')).not.toBeInTheDocument()
    })

    it('hides batch nav when no batch arrays are provided', () => {
      renderComponent(createImageCompareWidget({} as ImageCompareValue))

      expect(screen.queryByTestId('batch-nav')).not.toBeInTheDocument()
    })

    it('navigates before images with prev/next buttons', async () => {
      const user = userEvent.setup()
      const value: ImageCompareValue = { beforeImages, afterImages }
      renderComponent(createImageCompareWidget(value))

      const beforeBatch = screen.getByTestId('before-batch')
      const images = screen.getAllByRole('img')

      // Initially shows first before image
      expect(images[1]).toHaveAttribute('src', 'https://example.com/a1.jpg')

      // Click next on before
      const nextBtn = within(beforeBatch).getByTestId('batch-next')
      await user.click(nextBtn)
      expect(screen.getAllByRole('img')[1]).toHaveAttribute(
        'src',
        'https://example.com/a2.jpg'
      )
      expect(
        within(beforeBatch).getByTestId('batch-counter')
      ).toHaveTextContent('2 / 3')

      // Click next again
      await user.click(nextBtn)
      expect(screen.getAllByRole('img')[1]).toHaveAttribute(
        'src',
        'https://example.com/a3.jpg'
      )
      expect(
        within(beforeBatch).getByTestId('batch-counter')
      ).toHaveTextContent('3 / 3')

      // Next button should be disabled at last index
      expect(nextBtn).toBeDisabled()

      // Click prev
      const prevBtn = within(beforeBatch).getByTestId('batch-prev')
      await user.click(prevBtn)
      expect(screen.getAllByRole('img')[1]).toHaveAttribute(
        'src',
        'https://example.com/a2.jpg'
      )
    })

    it('navigates after images independently from before images', async () => {
      const user = userEvent.setup()
      const value: ImageCompareValue = { beforeImages, afterImages }
      renderComponent(createImageCompareWidget(value))

      const afterBatch = screen.getByTestId('after-batch')

      // Navigate after to index 1
      const nextBtn = within(afterBatch).getByTestId('batch-next')
      await user.click(nextBtn)
      expect(within(afterBatch).getByTestId('batch-counter')).toHaveTextContent(
        '2 / 2'
      )

      // After image should be b2, before image should still be a1
      const images = screen.getAllByRole('img')
      expect(images[0]).toHaveAttribute('src', 'https://example.com/b2.jpg')
      expect(images[1]).toHaveAttribute('src', 'https://example.com/a1.jpg')
    })

    it('disables prev button at first index', () => {
      const value: ImageCompareValue = { beforeImages, afterImages }
      renderComponent(createImageCompareWidget(value))

      const beforePrev = within(screen.getByTestId('before-batch')).getByTestId(
        'batch-prev'
      )
      const afterPrev = within(screen.getByTestId('after-batch')).getByTestId(
        'batch-prev'
      )
      expect(beforePrev).toBeDisabled()
      expect(afterPrev).toBeDisabled()
    })

    it('only shows controls for the side with multiple images', () => {
      const value: ImageCompareValue = {
        beforeImages,
        afterImages: ['https://example.com/b1.jpg']
      }
      renderComponent(createImageCompareWidget(value))

      expect(screen.getByTestId('batch-nav')).toBeInTheDocument()
      expect(
        within(screen.getByTestId('before-batch')).getByTestId('batch-counter')
      ).toBeInTheDocument()
      expect(screen.queryByTestId('after-batch')).not.toBeInTheDocument()
    })
  })
})
