// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import ModelStatus from './ModelStatus.vue'

const { showStatuses } = usePrototypeTweaks()

afterEach(() => {
  showStatuses.value = false
})

describe('ModelStatus', () => {
  it('stays hidden until the statuses tweak is on', () => {
    render(ModelStatus, { props: { status: 'degraded', variant: 'pill' } })
    expect(screen.queryByTestId('model-status')).toBeNull()
  })

  it('shows a pill once the tweak is on', () => {
    showStatuses.value = true
    render(ModelStatus, { props: { status: 'deprecated', variant: 'pill' } })
    expect(screen.getByTestId('model-status').textContent).toContain(
      'Deprecated'
    )
  })

  it('links a deprecated model to its successor in the banner', () => {
    showStatuses.value = true
    render(ModelStatus, {
      props: {
        status: 'deprecated',
        variant: 'banner',
        successor: { name: 'Kling 2.6', href: '/workshop/models/kling-2-6/' }
      }
    })
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/workshop/models/kling-2-6/')
    expect(link.textContent).toContain('Kling 2.6')
  })

  it('explains a degraded model without a link', () => {
    showStatuses.value = true
    render(ModelStatus, { props: { status: 'degraded', variant: 'banner' } })
    expect(screen.getByTestId('model-status-banner')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders nothing for a model without a status', () => {
    showStatuses.value = true
    render(ModelStatus, { props: { variant: 'banner' } })
    expect(screen.queryByTestId('model-status-banner')).toBeNull()
  })
})
