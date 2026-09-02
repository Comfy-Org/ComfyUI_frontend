// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/workshop'
import WorkshopModelCard from './WorkshopModelCard.vue'

const base: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 2,
  href: '/workshop/models/flux/',
  routerId: 'bfl/flux',
  capabilities: [],
  runs: 12_000,
  provider: 'Black Forest Labs',
  modality: 'image'
}

describe('WorkshopModelCard', () => {
  it('links the name and provider to the model page', () => {
    render(WorkshopModelCard, { props: { model: base } })
    const link = screen.getByTestId('workshop-model-card')
    expect(link.getAttribute('href')).toBe('/workshop/models/flux/')
    expect(screen.getByText('Flux')).toBeTruthy()
    expect(screen.getByText('Black Forest Labs')).toBeTruthy()
    expect(screen.queryByText(/credits|\$/)).toBeNull()
  })
})
