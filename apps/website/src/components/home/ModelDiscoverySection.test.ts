// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { discoveryProviders } from '../../data/modelDiscovery'
import ModelDiscoverySection from './ModelDiscoverySection.vue'

describe('ModelDiscoverySection', () => {
  it('only lines up providers that run models and have a preview', () => {
    expect(discoveryProviders.length).toBeGreaterThan(10)
    for (const provider of discoveryProviders) {
      expect(provider.modelCount, provider.name).toBeGreaterThan(0)
      expect(provider.thumbnailUrl, provider.name).toBeTruthy()
    }
  })

  it('sends every provider to the catalog filtered by that provider', () => {
    render(ModelDiscoverySection)

    const bytedance = screen.getByRole('link', { name: /ByteDance/ })
    expect(bytedance.getAttribute('href')).toBe('/workshop?provider=ByteDance')
    expect(screen.getByRole('link', { name: /Black Forest Labs/ })).toBeTruthy()

    const browse = screen.getByRole('link', { name: 'Browse all models' })
    expect(browse.getAttribute('href')).toBe('/workshop')
  })

  it('hides the looping copy of the row from assistive tech', () => {
    render(ModelDiscoverySection)

    const visible = screen.getAllByRole('link', { name: /ByteDance/ })
    const all = screen.getAllByRole('link', {
      name: /ByteDance/,
      hidden: true
    })
    expect(visible).toHaveLength(1)
    expect(all).toHaveLength(2)
    expect(visible[0].getAttribute('tabindex')).toBeNull()
    expect(all[1].getAttribute('tabindex')).toBe('-1')
  })

  it('loads a provider preview only once its card is hovered', async () => {
    const user = userEvent.setup()
    render(ModelDiscoverySection)

    expect(screen.queryByTestId('static-frame')).toBeNull()
    await user.hover(screen.getByRole('link', { name: /ByteDance/ }))
    expect(screen.getAllByTestId('static-frame').length).toBeGreaterThan(0)
  })

  it('localizes copy while keeping the English-only Workshop route', () => {
    render(ModelDiscoverySection, { props: { locale: 'zh-CN' } })

    const browse = screen.getByRole('link', { name: '浏览全部模型' })
    expect(browse.getAttribute('href')).toBe('/workshop')
  })
})
