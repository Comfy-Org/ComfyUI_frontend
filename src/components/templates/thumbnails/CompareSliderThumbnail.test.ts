/* eslint-disable testing-library/no-container */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

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

vi.mock('@vueuse/core', () => ({
  useMouseInElement: () => ({
    elementX: ref(50),
    elementWidth: ref(100),
    isOutside: ref(false)
  })
}))

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
    /* eslint-disable testing-library/no-node-access */
    const { container } = renderThumbnail()
    const divider = container.querySelector('.bg-white\\/30')
    expect(divider).not.toBeNull()
    /* eslint-enable testing-library/no-node-access */
  })

  it('positions slider based on default value', () => {
    /* eslint-disable testing-library/no-node-access */
    const { container } = renderThumbnail()
    const divider = container.querySelector('.bg-white\\/30') as HTMLElement
    expect(divider.style.left).toBe('50%')
    /* eslint-enable testing-library/no-node-access */
  })
})
