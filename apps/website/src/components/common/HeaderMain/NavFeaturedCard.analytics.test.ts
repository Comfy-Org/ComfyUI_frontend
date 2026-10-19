import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type * as PostHogModule from 'posthog-js'

import type { NavFeatured } from '@/data/mainNavigation'
import { initPostHog } from '@/scripts/posthog'
import NavFeaturedCard from './NavFeaturedCard.vue'

const hoisted = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockOnFeatureFlags: vi.fn<typeof PostHogModule.default.onFeatureFlags>(),
  mockGetFeatureFlag: vi.fn()
}))

vi.mock(import('astro:env/client'), () => ({
  WORKSHOP_INCLUDED: true,
  WORKSHOP_LOCAL_DEV: false,
  WORKSHOP_DEPLOY_ENV: ''
}))

vi.mock(import('posthog-js'), () => ({
  posthog: {
    init: vi.fn(),
    capture: hoisted.mockCapture,
    onFeatureFlags: hoisted.mockOnFeatureFlags,
    isFeatureEnabled: vi.fn(),
    getFeatureFlag: hoisted.mockGetFeatureFlag,
    identify: vi.fn(),
    reset: vi.fn(),
    get_property: vi.fn(),
    reloadFeatureFlags: vi.fn(),
    setPersonPropertiesForFlags: vi.fn()
  } as unknown as typeof PostHogModule.posthog
}))

const featured: NavFeatured = {
  analyticsId: 'launch',
  imageSrc: 'https://example.com/poster.webp',
  imageAlt: 'Featured clip',
  title: 'New release',
  cta: { label: 'Explore', href: '/launch' },
  variants: {
    'bold-image': {
      imageSrc: 'https://example.com/bold.webp',
      imageAlt: 'Bold variant'
    }
  }
}

function captured(name: string) {
  return hoisted.mockCapture.mock.calls
    .filter(([event]) => event === name)
    .map(([, props]) => [props.variant, props.variant_source])
}

describe('NavFeaturedCard events across a flag resolving between opens', () => {
  it('pairs the counted view and the click on the same resolved variant', async () => {
    initPostHog()

    const early = render(NavFeaturedCard, {
      props: { featured, dropdown: 'products', locale: 'en' }
    })
    early.unmount()

    hoisted.mockGetFeatureFlag.mockReturnValue('bold-image')
    hoisted.mockOnFeatureFlags.mock.calls.at(-1)?.[0]?.(
      [],
      {},
      { errorsLoading: false }
    )

    render(NavFeaturedCard, {
      props: { featured, dropdown: 'products', locale: 'en' }
    })
    await userEvent.setup().click(screen.getByRole('link'))

    expect(captured('website:nav_featured_card_viewed')).toEqual([
      ['control', 'unanswered'],
      ['bold-image', 'flag']
    ])
    expect(captured('website:nav_featured_card_clicked')).toEqual([
      ['bold-image', 'flag']
    ])
  })
})
