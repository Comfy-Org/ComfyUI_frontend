// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { discoveryModels } from '../../data/modelDiscovery'
import ModelDiscoverySection from './ModelDiscoverySection.vue'

describe('ModelDiscoverySection', () => {
  it('only lines up models that have a preview to reveal', () => {
    expect(discoveryModels.length).toBeGreaterThan(10)
    for (const { model } of discoveryModels) {
      expect(model.thumbnailUrl, model.slug).toBeTruthy()
    }
  })

  it('sends every lineup model to the catalog filtered by its provider', () => {
    render(ModelDiscoverySection)

    const seedance = screen.getByRole('link', { name: /Seedance 2/ })
    expect(seedance.getAttribute('href')).toBe('/workshop?provider=ByteDance')
    expect(screen.getByRole('link', { name: /Kling O3/ })).toBeTruthy()

    const browse = screen.getByRole('link', { name: 'Browse all models' })
    expect(browse.getAttribute('href')).toBe('/workshop')
  })

  it('hides the looping copy of the row from assistive tech', () => {
    render(ModelDiscoverySection)

    const visible = screen.getAllByRole('link', { name: /Seedance 2/ })
    const all = screen.getAllByRole('link', {
      name: /Seedance 2/,
      hidden: true
    })
    expect(visible).toHaveLength(1)
    expect(all).toHaveLength(2)
    expect(visible[0].getAttribute('tabindex')).toBeNull()
    expect(all[1].getAttribute('tabindex')).toBe('-1')
  })

  it('loads a model preview only once its card is hovered', async () => {
    const user = userEvent.setup()
    render(ModelDiscoverySection)

    expect(screen.queryByTestId('static-frame')).toBeNull()
    await user.hover(screen.getByRole('link', { name: /Seedance 2/ }))
    expect(screen.getAllByTestId('static-frame').length).toBeGreaterThan(0)
  })

  it('localizes copy while keeping the English-only Workshop route', () => {
    render(ModelDiscoverySection, { props: { locale: 'zh-CN' } })

    const browse = screen.getByRole('link', { name: '浏览全部模型' })
    expect(browse.getAttribute('href')).toBe('/workshop')
  })
})
