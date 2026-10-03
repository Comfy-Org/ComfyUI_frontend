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

  it('opens every Hub section from Products, with the Hub itself apart', async () => {
    await openProducts('/pricing', true)
    const menu = within(await screen.findByTestId('nav-dropdown'))

    await menu.findAllByRole('link')
    expect(menu.queryByRole('link', { name: /explore the hub/i })).toBeNull()
    expect(screen.getByRole('link', { name: /^Hub/ })).toHaveAttribute(
      'href',
      '/hub/'
    )
    expect(
      ['Apps', 'Workflows', 'Models'].map((name) =>
        menu
          .getByRole('link', { name: new RegExp(`^${name}$`) })
          .getAttribute('href')
      )
    ).toEqual(['/hub/apps/', '/hub/workflows/', '/hub/models/'])
  })

  it('opens Enterprise as one column with no Resources row', async () => {
    history.replaceState(null, '', '/pricing')
    render(HeaderMainDesktop, { props: { workshopInBuild: true } })
    await userEvent.click(screen.getByRole('button', { name: /^enterprise/i }))
    const menu = within(await screen.findByTestId('nav-dropdown'))

    expect(
      (await menu.findAllByRole('link')).map((link) => link.textContent.trim())
    ).toEqual([
      'Comfy Enterprise',
      'Forward Deployed Creatives',
      'Commercial licensing',
      'Contact sales'
    ])
    expect(menu.queryByText('Resources')).toBeNull()
  })

  it.for([
    { path: '/hub/', hub: true, products: false },
    { path: '/hub/models/', hub: false, products: true },
    { path: '/pricing', hub: false, products: false }
  ])(
    'marks the Hub or Products active on $path',
    async ({ path, hub, products }) => {
      const productsButton = await openProducts(path, true)

      expect([
        screen.getByRole('link', { name: /^Hub/ }).hasAttribute('data-active'),
        productsButton.hasAttribute('data-active')
      ]).toEqual([hub, products])
    }
  )
})
