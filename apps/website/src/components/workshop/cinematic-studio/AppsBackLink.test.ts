import { render, screen, within } from '@testing-library/vue'
import { expect, it } from 'vitest'

import AppsBackLink from './AppsBackLink.vue'

it('leads back to the apps beside a trail that ends on the app', () => {
  render(AppsBackLink, { props: { current: 'Re-shoot' } })

  expect(screen.getByTestId('apps-back')).toHaveAttribute('href', '/hub/apps/')
  const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
  expect(
    within(trail)
      .getAllByRole('link')
      .map((link) => [link.textContent.trim(), link.getAttribute('href')])
  ).toEqual([
    ['Hub', '/hub/'],
    ['Apps', '/hub/apps/']
  ])
  expect(within(trail).getByText('Re-shoot')).toHaveAttribute(
    'aria-current',
    'page'
  )
})
