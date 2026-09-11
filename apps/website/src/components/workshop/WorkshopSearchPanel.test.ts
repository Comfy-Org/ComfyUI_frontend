// @vitest-environment happy-dom
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
  it('searches capabilities consistently and suggests by name without fabricated usage', () => {
    render(WorkshopSearchPanel, {
      props: {
        models,
        query: 'upscale',
        providers: ['Provider A'],
        capabilities: []
      }
    })
    expect(
      screen.getAllByRole('button', { name: /^(Alpha|Zeta) Provider/ })
    ).toEqual([
      screen.getByRole('button', { name: 'Alpha Provider A' }),
      screen.getByRole('button', { name: 'Zeta Provider B' })
    ])
    expect(screen.getByRole('button', { name: 'Provider B 1' })).toBeTruthy()
    expect(screen.queryByText(/popular|\d+.*runs/i)).toBeNull()
  })

  it.for(['{Enter}', ' '])(
    'activates model and facet buttons with %s',
    async (key) => {
      const user = userEvent.setup()
      const { emitted } = render(WorkshopSearchPanel, {
        props: { models, query: '', providers: [], capabilities: [] }
      })
      screen.getByRole('button', { name: 'Alpha Provider A' }).focus()
      await user.keyboard(key)
      expect(emitted().pick).toEqual([[models[1]]])
      screen.getByRole('button', { name: 'Provider A 1' }).focus()
      await user.keyboard(key)
      expect(emitted().toggleProvider).toEqual([['Provider A']])
      screen.getByRole('button', { name: 'Upscale 2' }).focus()
      await user.keyboard(key)
      expect(emitted().toggleCapability).toEqual([['Upscale']])
    }
  )
})
