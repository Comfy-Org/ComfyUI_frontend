import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import HeaderMainDesktop from './HeaderMainDesktop.vue'

async function openProducts(path: string, workshopInBuild: boolean) {
  history.replaceState(null, '', path)
  render(HeaderMainDesktop, { props: { workshopInBuild } })
  const products = screen.getByRole('button', { name: /^products/i })
  await userEvent.click(products)
  return products
}

describe('HeaderMainDesktop', () => {
  it('keeps the Hub out of Products without a build opt-in', async () => {
    await openProducts('/pricing', false)
    const menu = within(await screen.findByTestId('nav-dropdown'))

    const links = await menu.findAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^\/hub\//)])
    )
  })

  it('opens every Hub space from Products', async () => {
    await openProducts('/pricing', true)
    const menu = within(await screen.findByTestId('nav-dropdown'))

    expect(
      await menu.findByRole('link', { name: /explore the hub/i })
    ).toHaveAttribute('href', '/hub/')
    expect(
      ['Apps', 'Workflows', 'Models'].map((name) =>
        menu
          .getByRole('link', { name: new RegExp(`^${name}\\s*Hub$`) })
          .getAttribute('href')
      )
    ).toEqual(['/hub/apps/', '/hub/workflows/', '/hub/models/'])
  })

  it.for([
    { path: '/hub/', active: true },
    { path: '/hub/models/', active: true },
    { path: '/pricing', active: false }
  ])('marks Products active on $path: $active', async ({ path, active }) => {
    const products = await openProducts(path, true)

    expect(products.hasAttribute('data-active')).toBe(active)
  })
})
