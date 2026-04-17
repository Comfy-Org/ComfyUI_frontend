import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'

vi.mock('@/components/templates/thumbnails/BaseThumbnail.vue', () => ({
  default: {
    name: 'BaseThumbnail',
    template: '<div class="base-thumbnail"><slot /></div>',
    props: ['hoverZoom', 'isHovered']
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

describe('DefaultThumbnail', () => {
  function renderThumbnail(props = {}) {
    return render(DefaultThumbnail, {
      props: {
        src: '/test-image.jpg',
        alt: 'Test Image',
        hoverZoom: 5,
        ...props
      }
    })
  }

  it('renders image with correct src and alt', () => {
    renderThumbnail()
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/test-image.jpg')
    expect(img).toHaveAttribute('alt', 'Test Image')
  })

  it('applies scale transform when hovered', () => {
    renderThumbnail({
      isHovered: true,
      hoverZoom: 10
    })
    expect(screen.getByRole('img')).toHaveStyle({
      transform: 'scale(1.1)'
    })
  })

  it('does not apply scale transform when not hovered', () => {
    renderThumbnail({
      isHovered: false
    })
    expect(screen.getByRole('img')).not.toHaveStyle({
      transform: 'scale(1.1)'
    })
  })

  it('applies video styling for video type', () => {
    renderThumbnail({
      isVideo: true
    })
    expect(screen.getByRole('img')).toHaveClass(
      'w-full',
      'h-full',
      'object-cover'
    )
  })

  it('applies image styling for non-video type', () => {
    renderThumbnail({
      isVideo: false
    })
    expect(screen.getByRole('img')).toHaveClass('max-w-full', 'object-contain')
  })

  it('applies correct styling for webp images', () => {
    renderThumbnail({
      src: '/test-video.webp',
      isVideo: true
    })
    expect(screen.getByRole('img')).toHaveClass('object-cover')
  })

  it('image is not draggable', () => {
    renderThumbnail()
    expect(screen.getByRole('img')).toHaveAttribute('draggable', 'false')
  })

  it('applies transition classes', () => {
    renderThumbnail()
    expect(screen.getByRole('img')).toHaveClass(
      'transform-gpu',
      'transition-transform',
      'duration-300',
      'ease-out'
    )
  })
})
