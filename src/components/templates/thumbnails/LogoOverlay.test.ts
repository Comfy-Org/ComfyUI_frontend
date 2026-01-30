import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import type { LogoInfo } from '@/platform/workflow/templates/types/template'

describe('LogoOverlay', () => {
  function mockGetLogoUrl(provider: string) {
    return `/logos/${provider}.png`
  }

  function mountOverlay(logos: LogoInfo[], props = {}) {
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

  it('renders a single logo with correct src and alt', () => {
    const wrapper = mountOverlay([{ provider: 'Google' }])
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('/logos/Google.png')
    expect(img.attributes('alt')).toBe('Google')
  })

  it('renders multiple separate logo entries', () => {
    const wrapper = mountOverlay([
      { provider: 'Google' },
      { provider: 'OpenAI' },
      { provider: 'Stability' }
    ])
    expect(wrapper.findAll('img')).toHaveLength(3)
  })

  it('displays provider name as label for single provider', () => {
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
    function getLogoUrl(provider: string) {
      return provider === 'Google' ? '/logos/Google.png' : ''
    }
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

  describe('stacked logos', () => {
    it('renders multiple providers as stacked overlapping logos', () => {
      const wrapper = mountOverlay([{ provider: ['WaveSpeed', 'Hunyuan'] }])
      const images = wrapper.findAll('img')
      expect(images).toHaveLength(2)
      expect(images[0].attributes('alt')).toBe('WaveSpeed')
      expect(images[1].attributes('alt')).toBe('Hunyuan')
    })

    it('joins provider names with ampersand for default label', () => {
      const wrapper = mountOverlay([{ provider: ['WaveSpeed', 'Hunyuan'] }])
      const span = wrapper.find('span')
      expect(span.text()).toBe('WaveSpeed & Hunyuan')
    })

    it('uses custom label when provided', () => {
      const wrapper = mountOverlay([
        { provider: ['WaveSpeed', 'Hunyuan'], label: 'Custom Label' }
      ])
      const span = wrapper.find('span')
      expect(span.text()).toBe('Custom Label')
    })

    it('applies negative gap for overlap effect', () => {
      const wrapper = mountOverlay([
        { provider: ['WaveSpeed', 'Hunyuan'], gap: -8 }
      ])
      const images = wrapper.findAll('img')
      expect(images[1].attributes('style')).toContain('margin-left: -8px')
    })

    it('applies default gap when not specified', () => {
      const wrapper = mountOverlay([{ provider: ['WaveSpeed', 'Hunyuan'] }])
      const images = wrapper.findAll('img')
      expect(images[1].attributes('style')).toContain('margin-left: -6px')
    })

    it('filters out invalid providers from stacked logos', () => {
      function getLogoUrl(provider: string) {
        return provider === 'WaveSpeed' ? '/logos/WaveSpeed.png' : ''
      }
      const wrapper = mount(LogoOverlay, {
        props: {
          logos: [{ provider: ['WaveSpeed', 'Unknown'] }],
          getLogoUrl
        }
      })
      expect(wrapper.findAll('img')).toHaveLength(1)
      expect(wrapper.find('span').text()).toBe('WaveSpeed')
    })
  })

  describe('styling', () => {
    it('applies default opacity of 0.85', () => {
      const wrapper = mountOverlay([{ provider: 'Google' }])
      const pill = wrapper.find('.rounded-full')
      expect(pill.attributes('style')).toContain('opacity: 0.85')
    })

    it('applies custom opacity', () => {
      const wrapper = mountOverlay([{ provider: 'Google', opacity: 0.5 }])
      const pill = wrapper.find('.rounded-full')
      expect(pill.attributes('style')).toContain('opacity: 0.5')
    })

    it('logos have white border for stacking visibility', () => {
      const wrapper = mountOverlay([{ provider: 'Google' }])
      const img = wrapper.find('img')
      expect(img.classes()).toContain('border-2')
      expect(img.classes()).toContain('border-white')
    })
  })
})
