import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'

vi.mock('@/components/templates/thumbnails/BaseThumbnail.vue', () => ({
  default: {
    name: 'BaseThumbnail',
    template: '<div class="base-thumbnail"><slot /></div>',
    props: ['isHovered']
  }
}))

describe('HoverDissolveThumbnail', () => {
  const mountThumbnail = (props = {}) => {
    return mount(HoverDissolveThumbnail, {
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
    const wrapper = mountThumbnail()
    const images = wrapper.findAll('img')
    expect(images.length).toBe(2)
    expect(images[0].attributes('src')).toBe('/base-image.jpg')
    expect(images[1].attributes('src')).toBe('/overlay-image.jpg')
  })

  it('applies correct alt text to both images', () => {
    const wrapper = mountThumbnail({ alt: 'Custom Alt Text' })
    const images = wrapper.findAll('img')
    expect(images[0].attributes('alt')).toBe('Custom Alt Text')
    expect(images[1].attributes('alt')).toBe('Custom Alt Text')
  })

  it('makes overlay image visible when hovered', () => {
    const wrapper = mountThumbnail({ isHovered: true })
    const overlayImage = wrapper.findAll('img')[1]
    expect(overlayImage.classes()).toContain('opacity-100')
    expect(overlayImage.classes()).not.toContain('opacity-0')
  })

  it('makes overlay image hidden when not hovered', () => {
    const wrapper = mountThumbnail({ isHovered: false })
    const overlayImage = wrapper.findAll('img')[1]
    expect(overlayImage.classes()).toContain('opacity-0')
    expect(overlayImage.classes()).not.toContain('opacity-100')
  })

  it('passes isHovered prop to BaseThumbnail', () => {
    const wrapper = mountThumbnail({ isHovered: true })
    const baseThumbnail = wrapper.findComponent({ name: 'BaseThumbnail' })
    expect(baseThumbnail.props('isHovered')).toBe(true)
  })

  it('applies transition classes to overlay image', () => {
    const wrapper = mountThumbnail()
    const overlayImage = wrapper.findAll('img')[1]
    expect(overlayImage.classes()).toContain('transition-opacity')
    expect(overlayImage.classes()).toContain('duration-300')
  })

  it('applies correct positioning to both images', () => {
    const wrapper = mountThumbnail()
    const images = wrapper.findAll('img')

    // Check base image
    expect(images[0].classes()).toContain('absolute')
    expect(images[0].classes()).toContain('inset-0')

    // Check overlay image
    expect(images[1].classes()).toContain('absolute')
    expect(images[1].classes()).toContain('inset-0')
  })
})
