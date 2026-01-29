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
    expect(container.classes()).toContain('top-2')
    expect(container.classes()).toContain('left-2')
  })

  it('applies custom position from logo config', () => {
    const wrapper = mountOverlay([
      { provider: 'Google', position: 'top-2 left-2' }
    ])
    const container = wrapper.find('div')
    expect(container.classes()).toContain('top-2')
    expect(container.classes()).toContain('left-2')
  })

  it('renders logo with fixed size and circular shape', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const img = wrapper.find('img')
    expect(img.classes()).toContain('h-5')
    expect(img.classes()).toContain('w-5')
    expect(img.classes()).toContain('rounded-[50%]')
  })

  it('renders pill container with correct styling', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const pill = wrapper.find('.rounded-full')
    expect(pill.exists()).toBe(true)
    expect(pill.classes()).toContain('bg-black/20')
  })

  it('displays provider name in pill', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const span = wrapper.find('span')
    expect(span.text()).toBe('Google')
  })

  it('applies default opacity of 1', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const pill = wrapper.find('.rounded-full')
    expect(pill.attributes('style')).toContain('opacity: 1')
  })

  it('applies custom opacity', () => {
    const wrapper = mountOverlay([{ provider: 'Google', opacity: 0.5 }])
    const pill = wrapper.find('.rounded-full')
    expect(pill.attributes('style')).toContain('opacity: 0.5')
  })

  it('images are not draggable', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const img = wrapper.find('img')
    expect(img.attributes('draggable')).toBe('false')
  })
})
