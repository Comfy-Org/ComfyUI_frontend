import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import type { LogoInfo } from '@/platform/workflow/templates/types/template'

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
      props: { logos, getLogoUrl: mockGetLogoUrl, ...props },
      global: { directives: { tooltip: {} } }
    })
  }

  it('renders nothing when logos array is empty', () => {
    renderOverlay([])
    expect(screen.queryAllByTestId('logo-badge')).toHaveLength(0)
  })

  it('renders one badge per provider', () => {
    renderOverlay([{ provider: ['Google', 'OpenAI'] }])
    expect(screen.getAllByTestId('logo-badge')).toHaveLength(2)
  })

  it('renders a monochrome comfy icon when the provider has one', () => {
    renderOverlay([{ provider: 'Google' }])
    expect(screen.getByRole('img', { name: 'Google' })).toHaveClass(
      'icon-mask-[comfy--gemini]'
    )
  })

  it('falls back to the raster logo when no comfy icon exists', () => {
    renderOverlay([{ provider: 'Unknown Brand' }])
    const img = screen.getByTestId('logo-img')
    expect(img).toHaveAttribute('src', '/logos/Unknown Brand.png')
    expect(img).toHaveAttribute('alt', 'Unknown Brand')
  })

  it('renders an icon-backed provider that has no logo url', () => {
    render(LogoOverlay, {
      props: { logos: [{ provider: 'Google' }], getLogoUrl: () => '' },
      global: { directives: { tooltip: {} } }
    })
    expect(screen.getByRole('img', { name: 'Google' })).toHaveClass(
      'icon-mask-[comfy--gemini]'
    )
  })

  it('filters out providers with no logo url and no icon', () => {
    render(LogoOverlay, {
      props: {
        logos: [{ provider: ['Google', 'Nothing'] }],
        getLogoUrl: (provider: string) =>
          provider === 'Google' ? '/logos/Google.png' : ''
      },
      global: { directives: { tooltip: {} } }
    })
    expect(screen.getAllByTestId('logo-badge')).toHaveLength(1)
  })

  it('collapses providers beyond the visible limit into a +N chip', () => {
    renderOverlay([
      {
        provider: ['Google', 'OpenAI', 'Kling', 'Luma', 'Runway', 'Veo', 'Vidu']
      }
    ])

    expect(screen.getAllByTestId('logo-badge')).toHaveLength(5)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('shows no +N chip when every provider fits', () => {
    renderOverlay([{ provider: ['Google', 'OpenAI'] }])
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
  })

  it('keeps the pill visible when its only image fails but an icon remains', async () => {
    renderOverlay([{ provider: ['Google', 'Unknown Brand'] }])

    await fireEvent.error(screen.getByTestId('logo-img'))

    expect(screen.getByRole('img', { name: 'Google' })).toBeVisible()
  })

  it('keeps remaining providers when one raster logo fails to load', async () => {
    renderOverlay([{ provider: ['Unknown One', 'Unknown Two'] }])
    const images = screen.getAllByTestId('logo-img')
    expect(images).toHaveLength(2)

    await fireEvent.error(images[0])

    expect(screen.getAllByTestId('logo-badge')).toHaveLength(2)
  })
})
