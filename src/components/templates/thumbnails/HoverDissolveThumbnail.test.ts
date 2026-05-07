import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'

vi.mock('@/components/templates/thumbnails/BaseThumbnail.vue', () => ({
  default: {
    name: 'BaseThumbnail',
    template: '<div class="base-thumbnail"><slot /></div>',
    props: ['isHovered']
  }
}))

vi.mock('@/components/templates/thumbnails/LazyMedia.vue', () => ({
  default: {
    name: 'LazyMedia',
    template:
      '<img :src="src" :alt="alt" :class="imageClass" :style="imageStyle" draggable="false" />',
    props: ['src', 'alt', 'imageClass', 'imageStyle']
  }
}))

describe('HoverDissolveThumbnail', () => {
  const renderThumbnail = (props = {}) => {
    return render(HoverDissolveThumbnail, {
      props: {
        baseImageSrc: '/base-image.jpg',
        overlayImageSrc: '/overlay-image.jpg',
        alt: 'Dissolve Image',
        isHovered: false,
        isVideo: false,
        ...props
      }
    })
  }

  it('renders both base and overlay images', () => {
    renderThumbnail()
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', '/base-image.jpg')
    expect(images[1]).toHaveAttribute('src', '/overlay-image.jpg')
  })

  it('applies correct alt text to both images', () => {
    renderThumbnail({ alt: 'Custom Alt Text' })
    const images = screen.getAllByRole('img')
    expect(images[0]).toHaveAttribute('alt', 'Custom Alt Text')
    expect(images[1]).toHaveAttribute('alt', 'Custom Alt Text')
  })

  it('makes overlay image visible when hovered', () => {
    renderThumbnail({ isHovered: true })
    const images = screen.getAllByRole('img')
    expect(images[1]).toHaveClass('opacity-100')
    expect(images[1]).not.toHaveClass('opacity-0')
  })

  it('makes overlay image hidden when not hovered', () => {
    renderThumbnail({ isHovered: false })
    const images = screen.getAllByRole('img')
    expect(images[1]).toHaveClass('opacity-0')
    expect(images[1]).not.toHaveClass('opacity-100')
  })
})
