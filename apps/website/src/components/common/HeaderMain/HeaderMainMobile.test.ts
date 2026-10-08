import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { HubMenuPreviews } from '@/data/mainNavigation'
import HeaderMainMobile from './HeaderMainMobile.vue'

async function openMenu(hubPreviews?: HubMenuPreviews) {
  const user = userEvent.setup()
  render(HeaderMainMobile, {
    props: { hubSections: { workflows: true, apps: true }, hubPreviews }
  })
  await user.click(screen.getByRole('button', { name: 'Toggle menu' }))
  return user
}

describe('HeaderMainMobile', () => {
  it('opens Hub, Products, Enterprise and Company as sections, with Pricing as a link', async () => {
    await openMenu()
    const menu = within(screen.getByRole('navigation', { name: 'Menu' }))

    expect(
      menu
        .getAllByRole('button')
        .map((button) => button.textContent.replace(/NEW$/, '').trim())
    ).toEqual(['Hub', 'Products', 'Enterprise', 'Company'])
    expect(menu.getByRole('link', { name: 'Pricing' })).toBeTruthy()
  })

  it('drills into the Hub formats and the Explore row', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: /^Hub/ }))

    expect(screen.getByText('Run, call by API or download').tagName).toBe('P')
    for (const header of ['Models', 'Workflows', 'Apps'])
      expect(screen.getByText(header, { exact: true })).toBeVisible()
    expect(screen.queryByTestId('nav-kind-icon')).toBeNull()
    expect(
      ['Seedream 5.0 Pro', 'Change material', 'All workflows'].map((name) =>
        screen.getByRole('link', { name }).getAttribute('href')
      )
    ).toEqual([
      '/hub/models/seedream-5-0-pro-text-to-image/',
      '/hub/workflows/change-material/',
      '/hub/workflows/'
    ])
    expect(
      screen.getByRole('link', { name: /^Explore the Hub/ })
    ).toHaveAttribute('href', '/hub/')
  })

  it('shows the Hub examples with their lines and no image', async () => {
    const user = await openMenu({
      '/hub/apps/reshoot/': {
        meta: 'Aim a new camera at your clip'
      }
    })
    await user.click(screen.getByRole('button', { name: /^Hub/ }))
    const reshoot = screen.getByRole('link', { name: /^Re-shoot/ })

    expect(reshoot).toHaveTextContent('Aim a new camera at your clip')
    expect(reshoot).toHaveAttribute('target', '_blank')
    expect(within(reshoot).queryAllByRole('img')).toHaveLength(0)
  })

  it('offers Hub, Products and Enterprise at the top level', async () => {
    await openMenu()

    expect(screen.getByRole('button', { name: /^Hub\b/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Products\b/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Enterprise\b/i })).toBeTruthy()
  })

  it('offers Browse Models under Products', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: /^Products\b/i }))

    expect(screen.getByRole('link', { name: /^Browse Models\b/i })).toBeTruthy()
  })

  it('names each icon-only social link under Company', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: /^Company\b/i }))

    const socialLinks = ['Discord', 'GitHub', 'YouTube', 'Reddit'].map(
      (label) => `${label} (opens in new tab)`
    )
    expect(
      socialLinks.map((name) =>
        screen.getByRole('link', { name }).textContent.trim()
      )
    ).toEqual(socialLinks)
  })

  it('shows a NEW badge on the Hub section only', async () => {
    await openMenu()

    expect(screen.getByRole('button', { name: /^Hub\s*NEW$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Products$/i })).toBeTruthy()
    expect(screen.getAllByText('NEW', { exact: true })).toHaveLength(1)
  })

  it('shows the Enterprise links in one section', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: /^Enterprise\b/i }))

    const enterpriseLinks = [
      'Comfy Enterprise',
      'Forward Deployed Creatives',
      'Team Billing',
      'Commercial Licensing',
      'Contact Sales'
    ]
    expect(
      enterpriseLinks.map(
        (label) => screen.getByRole('link', { name: label }).textContent
      )
    ).toEqual(enterpriseLinks)
  })
})
