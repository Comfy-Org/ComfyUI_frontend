import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import type { LogoInfo } from '@/platform/workflow/templates/types/template'

describe('LogoOverlay', () => {
  const mockGetLogoUrl = (provider: string) => `/logos/${provider}.png`

  const mountOverlay = (logos: LogoInfo[], props = {}) => {
    return mount(LogoOverlay, {
      props: {
        logos,
        getLogoUrl: mockGetLogoUrl,
        ...props
      }
    })
  }

  it('renders nothing when logos array is empty', () => {
    const wrapper = mountOverlay([])
    expect(wrapper.findAll('img')).toHaveLength(0)
  })

  it('renders a logo with correct src and alt', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('/logos/Google.png')
    expect(img.attributes('alt')).toBe('Google')
  })

  it('renders multiple logos', () => {
    const wrapper = mountOverlay([
      { provider: 'Google' },
      { provider: 'OpenAI' },
      { provider: 'Stability' }
    ])
    expect(wrapper.findAll('img')).toHaveLength(3)
  })

  it('applies default position when not specified', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const container = wrapper.find('div')
    expect(container.classes()).toContain('bottom-2')
    expect(container.classes()).toContain('right-2')
  })

  it('applies custom position from logo config', () => {
    const wrapper = mountOverlay([
      { provider: 'Google', position: 'top-2 left-2' }
    ])
    const container = wrapper.find('div')
    expect(container.classes()).toContain('top-2')
    expect(container.classes()).toContain('left-2')
  })

  it('applies default medium size class', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const img = wrapper.find('img')
    expect(img.classes()).toContain('h-8')
    expect(img.classes()).toContain('w-8')
  })

  it('applies small size class', () => {
    const wrapper = mountOverlay([{ provider: 'Google', size: 'sm' }])
    const img = wrapper.find('img')
    expect(img.classes()).toContain('h-6')
    expect(img.classes()).toContain('w-6')
  })

  it('applies large size class', () => {
    const wrapper = mountOverlay([{ provider: 'Google', size: 'lg' }])
    const img = wrapper.find('img')
    expect(img.classes()).toContain('h-12')
    expect(img.classes()).toContain('w-12')
  })

  it('applies default opacity', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const container = wrapper.find('div')
    expect(container.attributes('style')).toContain('opacity: 0.9')
  })

  it('applies custom opacity', () => {
    const wrapper = mountOverlay([{ provider: 'Google', opacity: 0.5 }])
    const container = wrapper.find('div')
    expect(container.attributes('style')).toContain('opacity: 0.5')
  })

  it('images are not draggable', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const img = wrapper.find('img')
    expect(img.attributes('draggable')).toBe('false')
  })
})
