import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'

import WidgetGalleria from './WidgetGalleria.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        galleryImage: 'Gallery image',
        galleryImagePosition: 'Gallery image {index} of {total}',
        galleryThumbnailPosition: 'Gallery thumbnail {index} of {total}',
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

function renderGallery(value: string[] = images, options: IWidgetOptions = {}) {
  return render(WidgetGalleria, {
    global: { plugins: [i18n] },
    attrs: {
      widget: createMockWidget({
        value,
        name: 'gallery',
        type: 'galleria',
        options
      })
    },
    props: { modelValue: value }
  })
}

describe('WidgetGalleria', () => {
  it.for([
    { name: 'null', value: null },
    { name: 'a non-array value', value: 'not-an-array' },
    { name: 'an array without image URLs', value: [null, 1, ''] }
  ])('renders an empty gallery for persisted $name', ({ value }) => {
    render(WidgetGalleria, {
      global: { plugins: [i18n] },
      props: { modelValue: value }
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders the active image and thumbnails with accessible labels', () => {
    renderGallery()

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

  it('moves between images and disables navigation at the bounds', async () => {
    const user = userEvent.setup()
    renderGallery()

    const previous = screen.getByRole('button', { name: 'Previous image' })
    const next = screen.getByRole('button', { name: 'Next image' })
    expect(previous).toBeDisabled()

    await user.click(next)
    expect(
      screen.getByRole('img', { name: 'Gallery image 2 of 3' })
    ).toHaveAttribute('src', images[1])

    await user.click(next)
    expect(next).toBeDisabled()

    await user.click(previous)
    expect(
      screen.getByRole('img', { name: 'Gallery image 2 of 3' })
    ).toHaveAttribute('src', images[1])
  })

  it('selects an image from its thumbnail', async () => {
    const user = userEvent.setup()
    renderGallery()

    const thumbnail = screen.getByRole('button', {
      name: 'Gallery thumbnail 3 of 3'
    })
    await user.click(thumbnail)

    expect(
      screen.getByRole('img', { name: 'Gallery image 3 of 3' })
    ).toHaveAttribute('src', images[2])
    expect(thumbnail).toHaveAttribute('aria-current', 'true')
    expect(
      screen.getByRole('button', { name: 'Gallery thumbnail 1 of 3' })
    ).not.toHaveAttribute('aria-current')
  })

  it('clamps the active image when the image list shrinks and recovers after emptying', async () => {
    const user = userEvent.setup()
    const gallery = renderGallery()

    await user.click(
      screen.getByRole('button', { name: 'Gallery thumbnail 3 of 3' })
    )
    await gallery.rerender({ modelValue: images.slice(0, 2) })

    expect(
      screen.getByRole('img', { name: 'Gallery image 2 of 2' })
    ).toHaveAttribute('src', images[1])

    await gallery.rerender({ modelValue: [] })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    await gallery.rerender({ modelValue: images })
    expect(
      screen.getByRole('img', { name: 'Gallery image 1 of 3' })
    ).toHaveAttribute('src', images[0])
  })

  it('ignores stale PrimeVue options while rendering schema images', async () => {
    vi.useFakeTimers()
    const options = {
      serialize: true,
      showThumbnails: false,
      showItemNavigators: false,
      autoPlay: true,
      circular: true,
      transitionInterval: 1000
    }
    renderGallery(images, options)

    expect(
      screen.getByRole('button', { name: 'Previous image' })
    ).toBeDisabled()
    expect(
      screen.getAllByRole('button', { name: /Gallery thumbnail/ })
    ).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(5000)
    expect(
      screen.getByRole('img', { name: 'Gallery image 1 of 3' })
    ).toHaveAttribute('src', images[0])
  })

  it('hides controls for a single image', () => {
    renderGallery([images[0]])

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
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
            previousImage: 'Previous',
            nextImage: 'Next'
          }
        }
      }
    })
    render(WidgetGalleria, {
      global: { plugins: [translated] },
      props: { modelValue: images }
    })

    expect(
      screen.getByRole('img', { name: '3 images, number 1' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '3 previews, number 1' })
    ).toBeInTheDocument()
  })
})
