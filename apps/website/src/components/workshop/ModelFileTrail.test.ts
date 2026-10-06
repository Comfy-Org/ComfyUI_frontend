import { render, screen, within } from '@testing-library/vue'
import { expect, it } from 'vitest'

import ModelFileTrail from './ModelFileTrail.vue'

it('leads back to the Hub models and names the file in the breadcrumb', () => {
  render(ModelFileTrail, { props: { name: 'ae.safetensors' } })

  expect(screen.getByTestId('model-back')).toHaveAttribute(
    'href',
    '/hub/models/'
  )
  const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
  expect(
    within(crumbs)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')])
  ).toEqual([
    ['Hub', '/hub/'],
    ['Models', '/hub/models/']
  ])
  expect(within(crumbs).getByText('ae.safetensors')).toHaveAttribute(
    'aria-current',
    'page'
  )
})
