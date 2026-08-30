import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

const images = [
  'https://example.com/one.jpg',
  'https://example.com/two.jpg',
  'https://example.com/three.jpg'
]

function createWidget(
  value: GalleryValue,
  options: Record<string, unknown> = {}
) {
  return createMockWidget<GalleryValue>({
    value,
    name: 'gallery',
    type: 'array',
    options
  })
}

function renderGallery(
  value: GalleryValue = images,
  options: Record<string, unknown> = {}
) {
  const widget = createWidget(value, options)
  return renderComponent(widget, value)
}

function renderComponent(
  widget: SimplifiedWidget<GalleryValue>,
  modelValue: GalleryValue
) {
  return render(WidgetGalleria, {
    global: { plugins: [i18n] },
    props: { widget, modelValue }
  })
}

describe('WidgetGalleria', () => {
  it('renders the active image and thumbnails with accessible labels', () => {
    renderGallery(images)

    expect(
      screen.getByRole('region', { name: 'Gallery image' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Gallery image 1 of 3' })
    ).toHaveAttribute('src', images[0])
    expect(
      screen.getAllByRole('button', { name: /Gallery thumbnail/ })
    ).toHaveLength(3)
  })

  it('uses item and thumbnail source priorities', () => {
    const value: GalleryImage[] = [
      {
        itemImageSrc: 'https://example.com/item.jpg',
        thumbnailImageSrc: 'https://example.com/thumbnail.jpg',
        src: 'https://example.com/fallback.jpg',
        alt: 'Custom image'
      },
      { src: 'https://example.com/second.jpg' }
    ]

    renderGallery(value)

    const customImages = screen.getAllByRole('img', { name: 'Custom image' })
    expect(customImages[0]).toHaveAttribute(
      'src',
      'https://example.com/item.jpg'
    )
    expect(customImages[1]).toHaveAttribute(
      'src',
      'https://example.com/thumbnail.jpg'
    )
  })

  it('moves between images and disables navigation at the bounds', async () => {
    const user = userEvent.setup()
    renderGallery(images)

    const previous = screen.getByRole('button', { name: 'Previous image' })
    const next = screen.getByRole('button', { name: 'Next image' })
    expect(previous).toBeDisabled()

    await user.click(next)
    expect(
      screen.getByRole('img', { name: 'Gallery image 2 of 3' })
    ).toHaveAttribute('src', images[1])

    await user.click(next)
    expect(next).toBeDisabled()
  })

  it('selects an image from its thumbnail', async () => {
    const user = userEvent.setup()
    renderGallery(images)

    await user.click(
      screen.getByRole('button', { name: 'Gallery thumbnail 3 of 3' })
    )

    expect(
      screen.getByRole('img', { name: 'Gallery image 3 of 3' })
    ).toHaveAttribute('src', images[2])
  })

  it('wraps navigation when circular mode is enabled', async () => {
    const user = userEvent.setup()
    renderGallery(images, { circular: true })

    await user.click(screen.getByRole('button', { name: 'Previous image' }))

    expect(
      screen.getByRole('img', { name: 'Gallery image 3 of 3' })
    ).toHaveAttribute('src', images[2])
  })

  it('hides thumbnails and navigation when configured', () => {
    renderGallery(images, {
      showThumbnails: false,
      showItemNavigators: false
    })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
  })

  it('hides controls for a single image', () => {
    renderGallery([images[0]])

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
  })

  it('advances automatically at the configured interval', async () => {
    vi.useFakeTimers()
    renderGallery(images, {
      autoPlay: true,
      circular: true,
      transitionInterval: 1000
    })

    await vi.advanceTimersByTimeAsync(1000)

    expect(
      screen.getByRole('img', { name: 'Gallery image 2 of 3' })
    ).toHaveAttribute('src', images[1])
  })
})
