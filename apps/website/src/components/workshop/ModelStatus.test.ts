// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import ModelStatus from './ModelStatus.vue'

const { modelState } = usePrototypeTweaks()

afterEach(() => {
  modelState.value = 'none'
})

describe('ModelStatus', () => {
  it('stays hidden while nothing asks for a state', () => {
    render(ModelStatus, { props: { variant: 'pill' } })
    expect(screen.queryByTestId('model-status')).toBeNull()
  })

  it('shows a pill once the prototype stands a state up', () => {
    modelState.value = 'deprecated'
    render(ModelStatus, { props: { variant: 'pill' } })
    expect(screen.getByTestId('model-status').textContent).toContain(
      'Deprecated'
    )
  })

  it('links a deprecated model to its successor in the banner', () => {
    modelState.value = 'deprecated'
    render(ModelStatus, {
      props: {
        variant: 'banner',
        successor: { name: 'Kling 2.6', href: '/workshop/models/kling-2-6/' }
      }
    })
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/workshop/models/kling-2-6/')
    expect(link.textContent).toContain('Kling 2.6')
  })

  it('explains a degraded model without a link', () => {
    modelState.value = 'degraded'
    render(ModelStatus, { props: { variant: 'banner' } })
    expect(screen.getByTestId('model-status-banner')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders nothing while no state is asked for', () => {
    render(ModelStatus, { props: { variant: 'banner' } })
    expect(screen.queryByTestId('model-status-banner')).toBeNull()
  })
})
