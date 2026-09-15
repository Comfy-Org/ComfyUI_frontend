import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import WorkshopSearchPanel from './WorkshopSearchPanel.vue'

const models: WorkshopModel[] = [
  {
    slug: 'zeta',
    name: 'Zeta',
    provider: 'Provider B',
    routerId: 'b/zeta',
    href: '/models/zeta/',
    workflowCount: 6,
    capabilities: ['Upscale']
  },
  {
    slug: 'alpha',
    name: 'Alpha',
    provider: 'Provider A',
    routerId: 'a/alpha',
    href: '/models/alpha/',
    workflowCount: 1,
    capabilities: ['Upscale']
  }
]

describe('WorkshopSearchPanel', () => {
  it('shows matching models only after a query is entered', async () => {
    const { rerender } = render(WorkshopSearchPanel, {
      props: { models, query: '' }
    })
    expect(screen.queryByRole('button')).toBeNull()

    await rerender({ query: 'upscale' })
    expect(
      screen.getAllByRole('button', { name: /^(Alpha|Zeta) Provider/ })
    ).toEqual([
      screen.getByRole('button', { name: 'Alpha Provider A' }),
      screen.getByRole('button', { name: 'Zeta Provider B' })
    ])
    expect(screen.queryByText(/popular|\d+.*runs/i)).toBeNull()
  })

  it('shows an empty state for a query without matches', () => {
    render(WorkshopSearchPanel, {
      props: { models, query: 'missing' }
    })
    expect(screen.getByText(/no match/i)).toBeTruthy()
  })

  it.for(['{Enter}', ' '])('activates a model result with %s', async (key) => {
    const user = userEvent.setup()
    const { emitted } = render(WorkshopSearchPanel, {
      props: { models, query: 'alpha' }
    })
    screen.getByRole('button', { name: 'Alpha Provider A' }).focus()
    await user.keyboard(key)
    expect(emitted().pick).toEqual([[models[1]]])
  })
})
