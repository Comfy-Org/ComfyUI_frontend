// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { discoveryProviders } from '../../data/modelDiscovery'
import type { DiscoveryProvider } from '../../data/modelDiscovery'
import ModelDiscoverySection from './ModelDiscoverySection.vue'

const providers: readonly DiscoveryProvider[] = [
  {
    name: 'Fixture Studio & Co',
    logo: '/icons/fixture.svg',
    modelCount: 2,
    thumbnailUrl: '/fixture-preview.png'
  }
]

describe('ModelDiscoverySection', () => {
  it('only lines up providers that run published models and have a preview', () => {
    expect(discoveryProviders.length).toBeGreaterThan(1)
    for (const provider of discoveryProviders) {
      expect(provider.modelCount, provider.name).toBeGreaterThan(0)
      expect(provider.thumbnailUrl, provider.name).toBeTruthy()
    }
  })

  it('sends every provider to the catalog filtered by that provider', () => {
    render(ModelDiscoverySection, { props: { providers } })

    const provider = screen.getByRole('link', { name: /Fixture Studio & Co/ })
    expect(provider.getAttribute('href')).toBe(
      '/models?provider=Fixture%20Studio%20%26%20Co'
    )
    expect(screen.queryByRole('link', { name: /ByteDance/ })).toBeNull()

    const browse = screen.getByRole('link', { name: 'Browse all models' })
    expect(browse.getAttribute('href')).toBe('/models')
  })

  it('hides the looping copy of the row from assistive tech', () => {
    render(ModelDiscoverySection, { props: { providers } })

    const visible = screen.getAllByRole('link', { name: /Fixture Studio & Co/ })
    const all = screen.getAllByRole('link', {
      name: /Fixture Studio & Co/,
      hidden: true
    })
    expect(visible).toHaveLength(1)
    expect(all).toHaveLength(2)
    expect(visible[0].getAttribute('tabindex')).toBeNull()
    expect(all[1].getAttribute('tabindex')).toBe('-1')
  })

  it('loads a provider preview only once its card is hovered', async () => {
    const user = userEvent.setup()
    render(ModelDiscoverySection, { props: { providers } })

    expect(screen.queryByTestId('static-frame')).toBeNull()
    await user.hover(screen.getByRole('link', { name: /Fixture Studio & Co/ }))
    expect(screen.getAllByTestId('static-frame').length).toBeGreaterThan(0)
  })

  it('localizes copy while keeping the English-only Workshop route', () => {
    render(ModelDiscoverySection, {
      props: { locale: 'zh-CN', providers }
    })

    const browse = screen.getByRole('link', { name: '浏览全部模型' })
    expect(browse.getAttribute('href')).toBe('/models')
  })
})
