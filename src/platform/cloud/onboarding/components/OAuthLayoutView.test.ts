import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import OAuthLayoutView from '@/platform/cloud/onboarding/components/OAuthLayoutView.vue'

vi.mock('@/components/toast/GlobalToast.vue', () => ({
  default: { template: '<div />' }
}))

const renderLayout = () =>
  render(OAuthLayoutView, {
    global: {
      stubs: { RouterView: { template: '<div data-testid="route-outlet" />' } }
    }
  })

describe('OAuthLayoutView', () => {
  afterEach(() => {
    screen.queryByTestId('splash-loader')?.remove()
  })

  it('removes the splash loader once mounted', () => {
    const splash = document.createElement('div')
    splash.id = 'splash-loader'
    splash.setAttribute('data-testid', 'splash-loader')
    document.body.appendChild(splash)

    renderLayout()

    expect(screen.queryByTestId('splash-loader')).toBeNull()
  })

  it('renders the routed outlet', () => {
    renderLayout()

    expect(screen.getByTestId('route-outlet')).toBeInTheDocument()
  })
})
