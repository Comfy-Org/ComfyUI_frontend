// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import ModelStatus from './ModelStatus.vue'

describe('ModelStatus', () => {
  it('stays hidden while nothing asks for a state', () => {
    render(ModelStatus, { props: { variant: 'pill' } })
    expect(screen.queryByTestId('model-status')).toBeNull()
  })

  it('shows the supplied model status', () => {
    render(ModelStatus, { props: { variant: 'pill', status: 'deprecated' } })
    expect(screen.getByText('Deprecated')).toBeTruthy()
  })

  it('links a deprecated model to its successor in the banner', () => {
    render(ModelStatus, {
      props: {
        variant: 'banner',
        status: 'deprecated',
        successor: { name: 'Kling 2.6', href: '/models/kling-2-6/' }
      }
    })
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/models/kling-2-6/')
    expect(link.textContent).toContain('Kling 2.6')
  })

  it('explains a degraded model without a link', () => {
    render(ModelStatus, { props: { variant: 'banner', status: 'degraded' } })
    expect(screen.getByTestId('model-status-banner')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders nothing while no state is asked for', () => {
    render(ModelStatus, { props: { variant: 'banner' } })
    expect(screen.queryByTestId('model-status-banner')).toBeNull()
  })
})
