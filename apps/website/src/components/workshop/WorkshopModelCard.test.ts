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
  modality: 'image',
  task: 'image-to-image'
}

describe('WorkshopModelCard', () => {
  it('links the name, provider badge and task to the model page', () => {
    render(WorkshopModelCard, { props: { model: base } })
    const link = screen.getByTestId('workshop-model-card')
    expect(link.getAttribute('href')).toBe('/workshop/models/flux/')
    expect(screen.getByText('Flux')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Black Forest Labs' })).toBeTruthy()
    expect(screen.getByTestId('model-card-task').textContent).toBe(
      'Image to Image'
    )
    expect(screen.queryByText(/credits|\$/)).toBeNull()
  })

  it('falls back to a provider badge and the modality when nothing matches', () => {
    render(WorkshopModelCard, {
      props: {
        model: { ...base, name: 'Mystery', provider: 'Nobody', task: undefined }
      }
    })
    expect(screen.getByTestId('model-card-provider').textContent).toBe('Nobody')
    expect(screen.getByTestId('model-card-task').textContent).toBe('Image')
  })
})
