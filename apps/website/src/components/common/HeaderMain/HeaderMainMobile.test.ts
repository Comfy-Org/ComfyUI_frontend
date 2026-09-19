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
  it('offers Products and Enterprise without a top-level Hub item', async () => {
    await openMenu()

    expect(screen.queryByRole('link', { name: /^Hub\b/i })).toBeNull()
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

    for (const label of ['Discord', 'GitHub', 'YouTube', 'Reddit']) {
      expect(screen.getByRole('link', { name: label })).toBeTruthy()
    }
  })

  it('labels a new top-level section with a NEW badge', async () => {
    await openMenu()

    expect(
      screen.getByRole('button', { name: /^Products\s*NEW$/i })
    ).toBeTruthy()
  })

  it('shows the Enterprise links in one section', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: /^Enterprise\b/i }))

    for (const label of [
      'Comfy Enterprise',
      'Forward Deployed Creatives',
      'Team Billing',
      'Commercial Licensing',
      'Contact Sales'
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeTruthy()
    }
  })
})
