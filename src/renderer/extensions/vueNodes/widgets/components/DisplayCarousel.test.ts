/* eslint-disable testing-library/no-node-access */
import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render, screen } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
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

function renderComponent(
  widget: SimplifiedWidget<GalleryValue>,
  modelValue: GalleryValue
) {
  return render(DisplayCarousel, {
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
  return renderComponent(widget, images)
}

function findThumbnails(container: Element) {
  return Array.from(container.querySelectorAll('div')).filter((div) => {
    return div.querySelector('img') && div.classList.contains('border-2')
  })
}

function findImageContainer(container: Element) {
  return container.querySelector('[tabindex="0"]') as HTMLElement
}

function findGridButtons(container: Element) {
  return Array.from(container.querySelectorAll('button')).filter((btn) =>
    btn.querySelector('img')
  )
}

describe('DisplayCarousel Single Mode', () => {
  describe('Component Rendering', () => {
    it('renders main image', () => {
      createGalleriaWrapper([...TEST_IMAGES_SMALL])

      const img = screen.getAllByRole('img')[0]
      expect(img).toHaveAttribute('src', TEST_IMAGES_SMALL[0])
    })

    it('displays empty gallery when no images provided', () => {
      createGalleriaWrapper([])

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('handles null value gracefully', () => {
      const widget = createGalleriaWidget([])
      renderComponent(widget, fromAny<GalleryValue, unknown>(null))

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('handles undefined value gracefully', () => {
      const widget = createGalleriaWidget([])
      renderComponent(widget, fromAny<GalleryValue, unknown>(undefined))

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  describe('String Array Input', () => {
    it('converts string array to image objects and displays first', () => {
      createGalleriaWrapper([...TEST_IMAGES_SMALL])

      const img = screen.getAllByRole('img')[0]
      expect(img).toHaveAttribute('src', 'https://example.com/image0.jpg')
    })

    it('handles single string image', () => {
      createGalleriaWrapper([...TEST_IMAGES_SINGLE])

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/single.jpg')
    })
  })

  describe('Object Array Input', () => {
    it('preserves image objects and displays first', () => {
      createGalleriaWrapper([...TEST_IMAGE_OBJECTS])

      const img = screen.getAllByRole('img')[0]
      expect(img).toHaveAttribute('src', 'https://example.com/image0.jpg')
      expect(img).toHaveAttribute('alt', 'Test image 0')
    })

    it('handles mixed object properties with src fallback', () => {
      const images: GalleryImage[] = [
        { src: 'https://example.com/image1.jpg', alt: 'First' }
      ]
      createGalleriaWrapper(images)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/image1.jpg')
    })
  })

  describe('Thumbnail Display', () => {
    it('shows thumbnails when multiple images present', () => {
      const { container } = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      const thumbnailButtons = findThumbnails(container)
      expect(thumbnailButtons).toHaveLength(3)
    })

    it('hides thumbnails for single image', () => {
      const { container } = createGalleriaWrapper([...TEST_IMAGES_SINGLE])

      const thumbnailButtons = findThumbnails(container)
      expect(thumbnailButtons).toHaveLength(0)
    })

    it('thumbnails are not interactive', () => {
      const { container } = createGalleriaWrapper([...TEST_IMAGES_SMALL])

      const thumbnails = findThumbnails(container)
      expect(thumbnails[0].tagName).not.toBe('BUTTON')
    })
  })

  describe('Navigation Buttons', () => {
    it('shows navigation buttons when multiple images present', () => {
      createGalleriaWrapper([...TEST_IMAGES_SMALL])

      expect(
        screen.getByRole('button', { name: 'Previous image' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Next image' })
      ).toBeInTheDocument()
    })

    it('hides navigation buttons for single image', () => {
      createGalleriaWrapper([...TEST_IMAGES_SINGLE])

      expect(
        screen.queryByRole('button', { name: 'Previous image' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Next image' })
      ).not.toBeInTheDocument()
    })

    it('respects widget option to hide navigation buttons', () => {
      createGalleriaWrapper([...TEST_IMAGES_SMALL], {
        showItemNavigators: false
      })

      expect(
        screen.queryByRole('button', { name: 'Previous image' })
      ).not.toBeInTheDocument()
    })

    it('navigates to next image on next click', async () => {
      createGalleriaWrapper([...TEST_IMAGES_SMALL])
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Next image' }))
      await nextTick()

      const mainImg = screen.getAllByRole('img')[0]
      expect(mainImg).toHaveAttribute('src', 'https://example.com/image1.jpg')
    })

    it('navigates to previous image on prev click', async () => {
      createGalleriaWrapper([...TEST_IMAGES_SMALL])
      const user = userEvent.setup()

      // Go to second image first
      await user.click(screen.getByRole('button', { name: 'Next image' }))
      await nextTick()

      // Go back
      await user.click(screen.getByRole('button', { name: 'Previous image' }))
      await nextTick()

      const mainImg = screen.getAllByRole('img')[0]
      expect(mainImg).toHaveAttribute('src', 'https://example.com/image0.jpg')
    })

    it('wraps from first to last image on previous click', async () => {
      createGalleriaWrapper([...TEST_IMAGES_SMALL])
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Previous image' }))
      await nextTick()

      const mainImg = screen.getAllByRole('img')[0]
      expect(mainImg).toHaveAttribute('src', 'https://example.com/image2.jpg')
    })

    it('wraps from last to first image on next click', async () => {
      createGalleriaWrapper([...TEST_IMAGES_SMALL])
      const user = userEvent.setup()

      // Navigate to last image
      await user.click(screen.getByRole('button', { name: 'Next image' }))
      await user.click(screen.getByRole('button', { name: 'Next image' }))
      await nextTick()

      // Next from last should wrap to first
      await user.click(screen.getByRole('button', { name: 'Next image' }))
      await nextTick()

      const mainImg = screen.getAllByRole('img')[0]
      expect(mainImg).toHaveAttribute('src', 'https://example.com/image0.jpg')
    })
  })
})

describe('DisplayCarousel Accessibility', () => {
  it('shows controls on focusin for keyboard users', async () => {
    const { container } = createGalleriaWrapper([...TEST_IMAGES_SMALL])

    fireEvent.focusIn(findImageContainer(container))
    await nextTick()

    expect(
      screen.getByRole('button', { name: 'Switch to grid view' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Edit or mask image' })
    ).toBeInTheDocument()
  })

  it('hides controls on focusout when focus leaves component', async () => {
    const { container } = createGalleriaWrapper([...TEST_IMAGES_SMALL])

    fireEvent.focusIn(findImageContainer(container))
    await nextTick()

    // Focus leaves the image container entirely
    fireEvent.focusOut(findImageContainer(container), {
      relatedTarget: null
    })
    await nextTick()

    expect(
      screen.queryByRole('button', { name: 'Switch to grid view' })
    ).not.toBeInTheDocument()
  })
})

describe('DisplayCarousel Grid Mode', () => {
  it('switches to grid mode via toggle button on hover', async () => {
    const { container } = createGalleriaWrapper([...TEST_IMAGES_SMALL])
    const user = userEvent.setup()

    // Trigger focus on image container to reveal toggle button
    fireEvent.focusIn(findImageContainer(container))
    await nextTick()

    const toggleBtn = screen.getByRole('button', {
      name: 'Switch to grid view'
    })
    expect(toggleBtn).toBeInTheDocument()

    await user.click(toggleBtn)
    await nextTick()

    // Grid mode should show all images as grid items
    const gridImages = screen.getAllByRole('img')
    expect(gridImages).toHaveLength(TEST_IMAGES_SMALL.length)
  })

  it('does not show grid toggle for single image', async () => {
    const { container } = createGalleriaWrapper([...TEST_IMAGES_SINGLE])

    fireEvent.focusIn(findImageContainer(container))
    await nextTick()

    expect(
      screen.queryByRole('button', { name: 'Switch to grid view' })
    ).not.toBeInTheDocument()
  })

  it('grid mode has no overlay icons', async () => {
    const { container } = createGalleriaWrapper([...TEST_IMAGES_SMALL])
    const user = userEvent.setup()

    // Switch to grid via focus on image container
    fireEvent.focusIn(findImageContainer(container))
    await nextTick()
    await user.click(
      screen.getByRole('button', { name: 'Switch to grid view' })
    )
    await nextTick()

    // Grid mode should have no toggle/back button
    expect(
      screen.queryByRole('button', { name: 'Switch to single view' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Switch to grid view' })
    ).not.toBeInTheDocument()
  })

  it('always uses undo-2 icon for grid toggle button', async () => {
    const { container } = createGalleriaWrapper([...TEST_IMAGES_SMALL])
    const user = userEvent.setup()

    // Show controls
    fireEvent.focusIn(findImageContainer(container))
    await nextTick()

    const toggleBtn = screen.getByRole('button', {
      name: 'Switch to grid view'
    })
    const icon = toggleBtn.querySelector('i')
    expect(icon!.classList.contains('icon-[lucide--undo-2]')).toBe(true)

    // Switch to grid and back
    await user.click(toggleBtn)
    await nextTick()

    const gridButtons = findGridButtons(container)
    await user.click(gridButtons[0])
    await nextTick()

    fireEvent.focusIn(findImageContainer(container))
    await nextTick()

    // Icon should still be undo-2
    const toggleBtnAfter = screen.getByRole('button', {
      name: 'Switch to grid view'
    })
    const iconAfter = toggleBtnAfter.querySelector('i')
    expect(iconAfter!.classList.contains('icon-[lucide--undo-2]')).toBe(true)
  })

  it('shows grid button in single mode after selecting from grid', async () => {
    const { container } = createGalleriaWrapper([...TEST_IMAGES_SMALL])
    const user = userEvent.setup()

    // Switch to grid
    fireEvent.focusIn(findImageContainer(container))
    await nextTick()
    await user.click(
      screen.getByRole('button', { name: 'Switch to grid view' })
    )
    await nextTick()

    // Click first grid image to go back to single mode
    const gridButtons = findGridButtons(container)
    await user.click(gridButtons[0])
    await nextTick()

    // Hover to reveal controls
    fireEvent.focusIn(findImageContainer(container))
    await nextTick()

    // Should still show grid view button (same icon always)
    expect(
      screen.getByRole('button', { name: 'Switch to grid view' })
    ).toBeInTheDocument()
  })

  it('clicking grid image switches to single mode focused on that image', async () => {
    const { container } = createGalleriaWrapper([...TEST_IMAGES_SMALL])
    const user = userEvent.setup()

    // Switch to grid via focus on image container
    fireEvent.focusIn(findImageContainer(container))
    await nextTick()
    await user.click(
      screen.getByRole('button', { name: 'Switch to grid view' })
    )
    await nextTick()

    // Click second grid image
    const gridButtons = findGridButtons(container)
    await user.click(gridButtons[1])
    await nextTick()

    // Should be in single mode showing the second image
    const mainImg = screen.getAllByRole('img')[0]
    expect(mainImg).toHaveAttribute('src', 'https://example.com/image1.jpg')
  })

  it('reverts to single mode when images reduce to one', async () => {
    const images = ref<GalleryValue>([...TEST_IMAGES_SMALL])
    const widget = createGalleriaWidget([...TEST_IMAGES_SMALL])
    const { container, rerender } = render(DisplayCarousel, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn }), i18n]
      },
      props: { widget, modelValue: images.value }
    })

    // Switch to grid via focus on image container
    fireEvent.focusIn(findImageContainer(container))
    await nextTick()
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'Switch to grid view' })
    )
    await nextTick()

    // Reduce to single image
    await rerender({ widget, modelValue: [TEST_IMAGES_SMALL[0]] })
    await nextTick()

    // Should revert to single mode (single image, no grid button)
    expect(
      screen.queryByRole('button', { name: 'Switch to grid view' })
    ).not.toBeInTheDocument()
  })
})

describe('DisplayCarousel Edge Cases', () => {
  it('handles empty array gracefully', () => {
    const { container } = createGalleriaWrapper([])

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(findThumbnails(container)).toHaveLength(0)
  })

  it('filters out malformed image objects without valid src', () => {
    const malformedImages = [{}, { randomProp: 'value' }, null, undefined]
    createGalleriaWrapper(malformedImages as string[])

    // All filtered out: null/undefined removed, then objects without src filtered
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('handles very large image arrays', () => {
    const largeImageArray = createImageStrings(100)
    const { container } = createGalleriaWrapper(largeImageArray)

    const thumbnailButtons = findThumbnails(container)
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
    createGalleriaWrapper(invalidUrls)

    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
  })

  it('filters out empty string URLs', () => {
    createGalleriaWrapper([''])
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
