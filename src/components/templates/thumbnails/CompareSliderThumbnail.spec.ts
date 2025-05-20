import { mount } from '@vue/test-utils'
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

vi.mock('@vueuse/core', () => ({
  useMouseInElement: () => ({
    elementX: ref(50),
    elementWidth: ref(100),
    isOutside: ref(false)
  })
}))

describe('CompareSliderThumbnail', () => {
  const mountThumbnail = (props = {}) => {
    return mount(CompareSliderThumbnail, {
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

  it('applies clip-path style to overlay image', () => {
    const wrapper = mountThumbnail()
    const overlay = wrapper.findAll('img')[1]
    expect(overlay.attributes('style')).toContain('clip-path')
  })

  it('renders slider divider', () => {
    const wrapper = mountThumbnail()
    const divider = wrapper.find('.bg-white\\/30')
    expect(divider.exists()).toBe(true)
  })

  it('positions slider based on default value', () => {
    const wrapper = mountThumbnail()
    const divider = wrapper.find('.bg-white\\/30')
    expect(divider.attributes('style')).toContain('left: 21%')
  })

  it('passes isHovered prop to BaseThumbnail', () => {
    const wrapper = mountThumbnail({ isHovered: true })
    const baseThumbnail = wrapper.findComponent({ name: 'BaseThumbnail' })
    expect(baseThumbnail.props('isHovered')).toBe(true)
  })
})
