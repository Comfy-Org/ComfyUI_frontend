import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type {
  GalleriaImage,
  GalleriaValue,
  GalleriaWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetGalleria from './WidgetGalleria.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        galleryImage: 'Gallery image',
        galleryThumbnail: 'Gallery thumbnail',
        galleryImagePosition: 'Gallery image {index} of {total}',
        galleryThumbnailPosition: 'Gallery thumbnail {index} of {total}',
        galleryThumbnailLabel: '{alt}, gallery thumbnail {index} of {total}',
        previousImage: 'Previous image',
        nextImage: 'Next image',
        playGallery: 'Play gallery',
        pauseGallery: 'Pause gallery'
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
  value: GalleriaValue,
  options: GalleriaWidgetOptions = {}
) {
  return createMockWidget<GalleriaValue>({
    value,
    name: 'gallery',
    type: 'array',
    options
  })
}

function renderGallery(
  value: GalleriaValue = images,
  options: GalleriaWidgetOptions = {}
) {
  const widget = createWidget(value, options)
  return renderComponent(widget, value)
}

function renderComponent(
  widget: SimplifiedWidget<GalleriaValue, GalleriaWidgetOptions>,
  modelValue: GalleriaValue
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
    const value: GalleriaImage[] = [
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

  it('includes positions in thumbnail names when custom alts are duplicated', () => {
    const value: GalleriaImage[] = [
      { src: images[0], alt: 'Preview' },
      { src: images[1], alt: 'Preview' }
    ]

    renderGallery(value)

    expect(
      screen.getByRole('button', {
        name: 'Preview, gallery thumbnail 1 of 2'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Preview, gallery thumbnail 2 of 2'
      })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Preview' })).toHaveLength(3)
  })

  it('clamps the active image when the image list shrinks', async () => {
    const user = userEvent.setup()
    const gallery = renderGallery(images)

    await user.click(
      screen.getByRole('button', { name: 'Gallery thumbnail 3 of 3' })
    )
    await gallery.rerender({ modelValue: images.slice(0, 2) })

    expect(
      screen.getByRole('img', { name: 'Gallery image 2 of 2' })
    ).toHaveAttribute('src', images[1])
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

  it('allows autoplay to be paused and resumed', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderGallery(images, {
      autoPlay: true,
      circular: true,
      transitionInterval: 1000
    })

    await user.click(screen.getByRole('button', { name: 'Pause gallery' }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(
      screen.getByRole('img', { name: 'Gallery image 1 of 3' })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Play gallery' }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(
      screen.getByRole('img', { name: 'Gallery image 2 of 3' })
    ).toBeInTheDocument()
  })

  it('stays paused when the image count changes', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const gallery = renderGallery(images, {
      autoPlay: true,
      circular: true,
      transitionInterval: 1000
    })

    await user.click(screen.getByRole('button', { name: 'Pause gallery' }))
    await gallery.rerender({
      modelValue: [...images, 'https://example.com/four.jpg']
    })
    await vi.advanceTimersByTimeAsync(1000)

    expect(
      screen.getByRole('img', { name: 'Gallery image 1 of 4' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play gallery' })).toBeVisible()
  })

  it('pauses autoplay after manual navigation', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderGallery(images, {
      autoPlay: true,
      circular: true,
      transitionInterval: 1000
    })

    await user.click(screen.getByRole('button', { name: 'Next image' }))
    await vi.advanceTimersByTimeAsync(1000)

    expect(
      screen.getByRole('img', { name: 'Gallery image 2 of 3' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play gallery' })).toBeVisible()
  })

  it('localizes the complete image and thumbnail positions', () => {
    const translated = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          g: {
            galleryImage: 'Image',
            galleryImagePosition: '{total} images, number {index}',
            galleryThumbnailPosition: '{total} previews, number {index}',
            galleryThumbnailLabel: '{alt}; {total} previews, number {index}',
            previousImage: 'Previous',
            nextImage: 'Next'
          }
        }
      }
    })
    render(WidgetGalleria, {
      global: { plugins: [translated] },
      props: { widget: createWidget(images), modelValue: images }
    })

    expect(
      screen.getByRole('img', { name: '3 images, number 1' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '3 previews, number 1' })
    ).toBeInTheDocument()
  })
})
