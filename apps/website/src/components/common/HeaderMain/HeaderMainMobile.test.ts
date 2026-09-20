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
  it('offers Products and Enterprise without a top-level Models item', async () => {
    await openMenu()

    expect(screen.queryByRole('button', { name: /^Models\b/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^Products\b/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Enterprise\b/i })).toBeTruthy()
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
