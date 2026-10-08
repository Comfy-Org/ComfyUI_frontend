import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import HeaderMainMobile from './HeaderMainMobile.vue'

async function openMenu() {
  const user = userEvent.setup()
  render(HeaderMainMobile)
  await user.click(screen.getByRole('button', { name: 'Toggle menu' }))
  return user
}

describe('HeaderMainMobile', () => {
  it('offers Hub, Products and Enterprise at the top level', async () => {
    await openMenu()

    expect(
      screen.getByRole('link', { name: /^Hub\b/i }).getAttribute('href')
    ).toBe('/hub/models/')
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

    const socialLinks = ['Discord', 'GitHub', 'YouTube', 'Reddit']
    expect(
      socialLinks.map(
        (label) => screen.getByRole('link', { name: label }).textContent
      )
    ).toEqual(socialLinks)
  })

  it('shows no NEW badge on the top-level sections', async () => {
    await openMenu()

    expect(screen.getByRole('button', { name: /^Products$/i })).toBeTruthy()
    expect(screen.queryByText('NEW', { exact: true })).toBeNull()
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
