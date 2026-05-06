import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'

vi.mock('@/components/templates/thumbnails/BaseThumbnail.vue', () => ({
  default: {
    name: 'BaseThumbnail',
    template: '<div class="base-thumbnail"><slot /></div>',
    props: ['isHovered']
  }
}))

vi.mock('@/components/common/LazyImage.vue', () => ({
  default: {
    name: 'LazyImage',
    template:
      '<img :src="src" :alt="alt" :class="imageClass" :style="imageStyle" draggable="false" />',
    props: ['src', 'alt', 'imageClass', 'imageStyle']
  }
}))

const mockRect = (el: HTMLElement, width: number) => {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: width,
    bottom: 100,
    width,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => ({})
  } as DOMRect)
}

describe('CompareSliderThumbnail', () => {
  const renderThumbnail = (props = {}) => {
    return render(CompareSliderThumbnail, {
      props: {
        baseImageSrc: '/base-image.jpg',
        overlayImageSrc: '/overlay-image.jpg',
        alt: 'Comparison Image',
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

  it('applies clip-path style to overlay image', () => {
    renderThumbnail()
    const images = screen.getAllByRole('img')
    expect(images[1].style.clipPath).toContain('inset')
  })

  it('renders slider divider', () => {
    renderThumbnail()
    const divider = screen.getByTestId('compare-slider-divider')
    expect(divider).toBeDefined()
  })

  it('positions slider based on default value', () => {
    renderThumbnail()
    const divider = screen.getByTestId('compare-slider-divider')
    expect(divider.style.left).toBe('50%')
  })

  it('updates slider position on mousemove', async () => {
    renderThumbnail()
    const container = screen.getByTestId('compare-slider-container')
    mockRect(container, 200)

    const user = userEvent.setup()
    await user.pointer({ target: container, coords: { clientX: 50 } })

    const divider = screen.getByTestId('compare-slider-divider')
    expect(divider.style.left).toBe('25%')
  })

  it('ignores mousemove when container has zero width', async () => {
    renderThumbnail()
    const container = screen.getByTestId('compare-slider-container')
    mockRect(container, 0)

    const user = userEvent.setup()
    await user.pointer({ target: container, coords: { clientX: 50 } })

    const divider = screen.getByTestId('compare-slider-divider')
    expect(divider.style.left).toBe('50%')
  })
})
