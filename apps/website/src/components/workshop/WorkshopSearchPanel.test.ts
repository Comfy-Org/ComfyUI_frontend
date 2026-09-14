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
    capabilities: ['text-to-image', 'kling']
  },
  {
    slug: 'alpha',
    name: 'Alpha',
    provider: 'Provider A',
    routerId: 'a/alpha',
    href: '/models/alpha/',
    workflowCount: 1,
    capabilities: ['text-to-image', 'premium']
  }
]

describe('WorkshopSearchPanel', () => {
  it('names matching models once a search has been typed', () => {
    render(WorkshopSearchPanel, {
      props: { models, query: 'text-to-image', capabilities: [] }
    })
    expect(
      screen.getAllByRole('button', { name: /^(Alpha|Zeta) Provider/ })
    ).toEqual([
      screen.getByRole('button', { name: 'Alpha Provider A' }),
      screen.getByRole('button', { name: 'Zeta Provider B' })
    ])
    expect(screen.queryByText(/popular|\d+.*runs/i)).toBeNull()
  })

  it('offers categories but no model list before anything is typed', () => {
    render(WorkshopSearchPanel, {
      props: { models, query: '  ', capabilities: [] }
    })
    expect(screen.queryByTestId('workshop-search-model')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByText(/no results/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'text-to-image 2' })).toBeTruthy()
  })

  it('withholds the maker and the version from the categories', () => {
    render(WorkshopSearchPanel, {
      props: { models, query: '', capabilities: [] }
    })
    expect(
      screen
        .getAllByTestId('workshop-search-capability')
        .map((chip) => chip.textContent.trim())
    ).toEqual(['text-to-image 2'])
  })

  it.for(['{Enter}', ' '])(
    'activates model and category buttons with %s',
    async (key) => {
      const user = userEvent.setup()
      const { emitted } = render(WorkshopSearchPanel, {
        props: { models, query: 'a', capabilities: [] }
      })
      screen.getByRole('button', { name: 'Alpha Provider A' }).focus()
      await user.keyboard(key)
      expect(emitted().pick).toEqual([[models[1]]])
      screen.getByRole('button', { name: 'text-to-image 2' }).focus()
      await user.keyboard(key)
      expect(emitted().toggleCapability).toEqual([['text-to-image']])
    }
  )
})
