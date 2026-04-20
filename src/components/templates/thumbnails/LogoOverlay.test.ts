import { fireEvent, render, screen } from '@testing-library/vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import type { LogoInfo } from '@/platform/workflow/templates/types/template'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      key === 'templates.logoProviderSeparator' ? ' & ' : key,
    locale: ref('en')
  })
}))

type LogoOverlayProps = ComponentProps<typeof LogoOverlay>

describe('LogoOverlay', () => {
  function mockGetLogoUrl(provider: string) {
    return `/logos/${provider}.png`
  }

  function renderOverlay(
    logos: LogoInfo[],
    props: Partial<LogoOverlayProps> = {}
  ) {
    return render(LogoOverlay, {
      props: {
        logos,
        getLogoUrl: mockGetLogoUrl,
        ...props
      }
    })
  }

  it('renders nothing when logos array is empty', () => {
    renderOverlay([])
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('renders a single logo with correct src and alt', () => {
    renderOverlay([{ provider: 'Google' }])
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/logos/Google.png')
    expect(img).toHaveAttribute('alt', 'Google')
  })

  it('renders multiple separate logo entries', () => {
    renderOverlay([
      { provider: 'Google' },
      { provider: 'OpenAI' },
      { provider: 'Stability' }
    ])
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('displays provider name as label for single provider', () => {
    renderOverlay([{ provider: 'Google' }])
    expect(screen.getByText('Google')).toBeInTheDocument()
  })

  it('images are not draggable', () => {
    renderOverlay([{ provider: 'Google' }])
    expect(screen.getByRole('img')).toHaveAttribute('draggable', 'false')
  })

  it('filters out logos with empty URLs', () => {
    function getLogoUrl(provider: string) {
      return provider === 'Google' ? '/logos/Google.png' : ''
    }
    render(LogoOverlay, {
      props: {
        logos: [{ provider: 'Google' }, { provider: 'Unknown' }],
        getLogoUrl
      }
    })
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('renders one logo per unique provider', () => {
    renderOverlay([{ provider: 'Google' }, { provider: 'OpenAI' }])
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  describe('stacked logos', () => {
    it('renders multiple providers as stacked overlapping logos', () => {
      renderOverlay([{ provider: ['WaveSpeed', 'Hunyuan'] }])
      const images = screen.getAllByRole('img')
      expect(images).toHaveLength(2)
      expect(images[0]).toHaveAttribute('alt', 'WaveSpeed')
      expect(images[1]).toHaveAttribute('alt', 'Hunyuan')
    })

    it('joins provider names with locale-aware conjunction for default label', () => {
      renderOverlay([{ provider: ['WaveSpeed', 'Hunyuan'] }])
      expect(screen.getByText('WaveSpeed and Hunyuan')).toBeInTheDocument()
    })

    it('uses custom label when provided', () => {
      renderOverlay([
        { provider: ['WaveSpeed', 'Hunyuan'], label: 'Custom Label' }
      ])
      expect(screen.getByText('Custom Label')).toBeInTheDocument()
    })

    it('applies negative gap for overlap effect', () => {
      renderOverlay([{ provider: ['WaveSpeed', 'Hunyuan'], gap: -8 }])
      const images = screen.getAllByRole('img')
      expect(images[1]).toHaveStyle({ marginLeft: '-8px' })
    })

    it('applies default gap when not specified', () => {
      renderOverlay([{ provider: ['WaveSpeed', 'Hunyuan'] }])
      const images = screen.getAllByRole('img')
      expect(images[1]).toHaveStyle({ marginLeft: '-6px' })
    })

    it('filters out invalid providers from stacked logos', () => {
      function getLogoUrl(provider: string) {
        return provider === 'WaveSpeed' ? '/logos/WaveSpeed.png' : ''
      }
      render(LogoOverlay, {
        props: {
          logos: [{ provider: ['WaveSpeed', 'Unknown'] }],
          getLogoUrl
        }
      })
      expect(screen.getAllByRole('img')).toHaveLength(1)
      expect(screen.getByText('WaveSpeed')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('keeps showing remaining providers when one image fails in stacked logos', async () => {
      renderOverlay([{ provider: ['Google', 'OpenAI'] }])
      const images = screen.getAllByTestId('logo-img')
      expect(images).toHaveLength(2)

      await fireEvent.error(images[0])

      const remainingImages = screen.getAllByTestId('logo-img')
      expect(remainingImages).toHaveLength(2)
      expect(remainingImages[1]).toHaveAttribute('alt', 'OpenAI')
    })
  })
})
