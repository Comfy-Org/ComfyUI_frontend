import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'

vi.mock('@/components/templates/thumbnails/BaseThumbnail.vue', () => ({
  default: {
    name: 'BaseThumbnail',
    template: '<div class="base-thumbnail"><slot /></div>',
    props: ['hoverZoom', 'isHovered']
  }
}))

describe('DefaultThumbnail', () => {
  const mountThumbnail = (props = {}) => {
    return mount(DefaultThumbnail, {
      props: {
        src: '/test-image.jpg',
        alt: 'Test Image',
        hoverZoom: 5,
        ...props
      }
    })
  }

  it('renders image with correct src and alt', () => {
    const wrapper = mountThumbnail()
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('/test-image.jpg')
    expect(img.attributes('alt')).toBe('Test Image')
  })

  it('applies scale transform when hovered', () => {
    const wrapper = mountThumbnail({
      isHovered: true,
      hoverZoom: 10
    })
    const img = wrapper.find('img')
    expect(img.attributes('style')).toContain('scale(1.1)')
  })

  it('does not apply scale transform when not hovered', () => {
    const wrapper = mountThumbnail({
      isHovered: false
    })
    const img = wrapper.find('img')
    expect(img.attributes('style')).toBeUndefined()
  })

  it('applies video styling for video type', () => {
    const wrapper = mountThumbnail({
      isVideo: true
    })
    const img = wrapper.find('img')
    expect(img.classes()).toContain('w-full')
    expect(img.classes()).toContain('h-full')
    expect(img.classes()).toContain('object-cover')
  })

  it('applies image styling for non-video type', () => {
    const wrapper = mountThumbnail({
      isVideo: false
    })
    const img = wrapper.find('img')
    expect(img.classes()).toContain('max-w-full')
    expect(img.classes()).toContain('object-contain')
  })

  it('applies correct styling for webp images', () => {
    const wrapper = mountThumbnail({
      src: '/test-video.webp',
      isVideo: true
    })
    const img = wrapper.find('img')
    expect(img.classes()).toContain('object-cover')
  })

  it('image is not draggable', () => {
    const wrapper = mountThumbnail()
    const img = wrapper.find('img')
    expect(img.attributes('draggable')).toBe('false')
  })

  it('applies transition classes', () => {
    const wrapper = mountThumbnail()
    const img = wrapper.find('img')
    expect(img.classes()).toContain('transform-gpu')
    expect(img.classes()).toContain('transition-transform')
    expect(img.classes()).toContain('duration-300')
    expect(img.classes()).toContain('ease-out')
  })

  it('passes correct props to BaseThumbnail', () => {
    const wrapper = mountThumbnail({
      hoverZoom: 20,
      isHovered: true
    })
    const baseThumbnail = wrapper.findComponent({ name: 'BaseThumbnail' })
    expect(baseThumbnail.props('hoverZoom')).toBe(20)
    expect(baseThumbnail.props('isHovered')).toBe(true)
  })
})
