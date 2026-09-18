import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { discoveryProviders } from '../../data/modelDiscovery'
import type { DiscoveryProvider } from '../../data/modelDiscovery'
import ModelDiscoverySection from './ModelDiscoverySection.vue'

const { enabled, settled } = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return { enabled: ref(true), settled: ref(true) }
})

vi.mock(import('../../scripts/posthog'), () => ({
  useWorkshopEnabled: () => enabled,
  useWorkshopEnabledSettled: () => settled
}))

beforeEach(() => {
  enabled.value = true
  settled.value = true
})

const providers: readonly DiscoveryProvider[] = [
  {
    name: 'Fixture Studio & Co',
    logo: '/icons/fixture.svg',
    modelCount: 2,
    thumbnailUrl: '/fixture-preview.png'
  }
]

describe('ModelDiscoverySection', async () => {
  it('keeps discovery unavailable until enabled and hides it on revocation', async () => {
    enabled.value = false
    render(ModelDiscoverySection, { props: { providers } })
    await nextTick()
    expect(screen.queryByText('Browse all models')).toBeNull()
    expect(screen.queryByText('Fixture Studio & Co')).toBeNull()

    enabled.value = true
    await nextTick()
    expect(screen.getByRole('link', { name: 'Browse all models' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Fixture Studio & Co/ })
    ).toBeTruthy()

    enabled.value = false
    await nextTick()
    expect(screen.queryByRole('link', { name: 'Browse all models' })).toBeNull()
    expect(
      screen.queryByRole('link', { name: /Fixture Studio & Co/ })
    ).toBeNull()
  })

  it('lines up multiple providers', () => {
    expect(discoveryProviders.length).toBeGreaterThan(1)
  })

  it.for(discoveryProviders)(
    '$name runs published models and has a preview',
    (provider) => {
      expect(provider.modelCount).toBeGreaterThan(0)
      expect(provider.thumbnailUrl).toBeTruthy()
    }
  )

  it('sends every provider to a visible catalog search', async () => {
    render(ModelDiscoverySection, { props: { providers } })
    await nextTick()

    const provider = screen.getByRole('link', { name: /Fixture Studio & Co/ })
    expect(provider.getAttribute('href')).toBe(
      '/models?q=Fixture+Studio+%26+Co'
    )
    expect(screen.queryByRole('link', { name: /ByteDance/ })).toBeNull()

    const browse = screen.getByRole('link', { name: 'Browse all models' })
    expect(browse.getAttribute('href')).toBe('/models')
  })

  it('hides the looping copy of the row from assistive tech', async () => {
    render(ModelDiscoverySection, { props: { providers } })
    await nextTick()

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
    await nextTick()

    expect(screen.queryByTestId('static-frame')).toBeNull()
    await user.hover(screen.getByRole('link', { name: /Fixture Studio & Co/ }))
    expect(screen.getAllByTestId('static-frame').length).toBeGreaterThan(0)
  })

  it('localizes copy while keeping the English-only Workshop route', async () => {
    render(ModelDiscoverySection, {
      props: { locale: 'zh-CN', providers }
    })
    await nextTick()

    const browse = screen.getByRole('link', { name: '浏览全部模型' })
    expect(browse.getAttribute('href')).toBe('/models')
  })
})
