import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, nextTick } from 'vue'
import type { Ref } from 'vue'

import { discoveryProviders } from '../../data/modelDiscovery'
import type {
  DiscoveryProvider,
  DiscoveryWorkflow
} from '../../data/modelDiscovery'
import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'
import ModelDiscoverySection from './ModelDiscoverySection.vue'

vi.mock(import('../../scripts/posthog'))

let enabled: Ref<boolean>
let settled: Ref<boolean>
let workflowsEnabled: Ref<boolean>

beforeEach(() => {
  enabled = ref(true)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
  settled = ref(true)
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(settled))
  workflowsEnabled = ref(true)
  vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(
    readonly(workflowsEnabled)
  )
})

const providers: readonly DiscoveryProvider[] = [
  {
    name: 'Fixture Studio & Co',
    logo: '/icons/fixture.svg',
    modelCount: 2,
    thumbnailUrl: '/fixture-preview.png'
  }
]

const workflows: readonly DiscoveryWorkflow[] = [
  {
    name: 'Turn a sketch into a render',
    href: '/models/workflows/sketch/',
    thumbnailUrl: '/fixture-workflow.png'
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

  // The tab is a promise that the other half exists. Where the catalogue does
  // not offer it, neither does the home page.
  it.for([
    { when: 'the flag is off', flag: false, rows: workflows },
    { when: 'there are no workflows', flag: true, rows: [] }
  ])('offers no second tab when $when', async ({ flag, rows }) => {
    workflowsEnabled.value = flag
    render(ModelDiscoverySection, {
      props: { providers, workflows: rows }
    })
    await nextTick()

    expect(screen.queryByTestId('catalogue-tabs')).toBeNull()
    expect(screen.getByRole('link', { name: 'Browse all models' })).toBeTruthy()
  })

  it('swaps the row and the way out when the workflows tab is pressed', async () => {
    const user = userEvent.setup()
    render(ModelDiscoverySection, { props: { providers, workflows } })
    await nextTick()

    expect(
      screen.getByRole('link', { name: /Fixture Studio & Co/ })
    ).toBeTruthy()

    await user.click(screen.getByTestId('catalogue-tab-workflows'))
    expect(
      screen.queryByRole('link', { name: /Fixture Studio & Co/ })
    ).toBeNull()
    expect(
      screen.getByRole('link', { name: /Turn a sketch into a render/ })
    ).toHaveAttribute('href', '/models/workflows/sketch/')
    expect(
      screen.getByRole('link', { name: 'Browse all workflows' })
    ).toHaveAttribute('href', '/models?type=workflows')
  })

  // Both rows cross the screen at one pace, so switching tabs does not speed
  // the marquee up or slow it down under the reader.
  it('paces both rows by the card, not by the row', async () => {
    const user = userEvent.setup()
    const pace = () =>
      screen
        .getAllByTestId('discovery-marquee')
        .map((copy) => copy.style.animationDuration)

    render(ModelDiscoverySection, {
      props: {
        providers: [providers[0], { ...providers[0], name: 'Second Studio' }],
        workflows: [
          workflows[0],
          { ...workflows[0], name: 'Second flow' },
          { ...workflows[0], name: 'Third flow' }
        ]
      }
    })
    await nextTick()
    expect(pace()).toEqual(['6s', '6s'])

    await user.click(screen.getByTestId('catalogue-tab-workflows'))
    expect(pace()).toEqual(['9s', '9s'])
  })

  it('starts the arriving row at its beginning, not mid-stride', async () => {
    const user = userEvent.setup()
    render(ModelDiscoverySection, { props: { providers, workflows } })
    await nextTick()

    const [copy] = screen.getAllByTestId('discovery-marquee')
    const animation = copy.animate([{ transform: 'none' }], {
      duration: 6000,
      iterations: Infinity
    })
    animation.pause()
    animation.currentTime = 2000
    expect(animation.currentTime).toBe(2000)

    await user.click(screen.getByTestId('catalogue-tab-workflows'))

    expect(animation.currentTime).toBe(0)
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
