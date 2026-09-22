import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import RelatedModels from './RelatedModels.vue'

function model(slug: string): WorkshopModel {
  return {
    slug,
    name: slug,
    workflowCount: 0,
    href: `/models/${slug}/`,
    routerId: slug,
    capabilities: []
  }
}

it('links each related model and the whole catalogue under the given heading', () => {
  render(RelatedModels, {
    props: {
      related: [model('flux-2-pro'), model('flux-2-flex')],
      heading: 'More from Black Forest Labs',
      headingShort: 'Related'
    }
  })

  expect(
    screen
      .getAllByTestId('workshop-model-card')
      .map((card) => card.getAttribute('href'))
  ).toEqual(['/models/flux-2-pro/', '/models/flux-2-flex/'])
  expect(screen.getByRole('heading', { level: 2 }).textContent).toContain(
    'More from Black Forest Labs'
  )
  expect(
    screen.getByRole('link', { name: /Browse all models/ })
  ).toHaveAttribute('href', '/models')
})
