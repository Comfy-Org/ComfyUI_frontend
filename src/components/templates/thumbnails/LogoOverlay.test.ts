import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import type { LogoInfo } from '@/platform/workflow/templates/types/template'

describe('LogoOverlay', () => {
  function mockGetLogoUrl(provider: string) {
    return `/logos/${provider}.png`
  }

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

  it('displays provider name in pill', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const span = wrapper.find('span')
    expect(span.text()).toBe('Google')
  })

  it('images are not draggable', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const img = wrapper.find('img')
    expect(img.attributes('draggable')).toBe('false')
  })

  it('filters out logos with empty URLs', () => {
    const getLogoUrl = (provider: string) =>
      provider === 'Google' ? '/logos/Google.png' : ''
    const wrapper = mount(LogoOverlay, {
      props: {
        logos: [{ provider: 'Google' }, { provider: 'Unknown' }],
        getLogoUrl
      }
    })
    expect(wrapper.findAll('img')).toHaveLength(1)
  })

  it('renders one logo per unique provider', () => {
    const wrapper = mountOverlay([
      { provider: 'Google' },
      { provider: 'OpenAI' }
    ])
    expect(wrapper.findAll('img')).toHaveLength(2)
  })
})
