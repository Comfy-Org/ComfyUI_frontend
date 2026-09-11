// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import HeaderMainMobile from './HeaderMainMobile.vue'

async function openMenu(workshopInBuild: boolean) {
  const user = userEvent.setup()
  render(HeaderMainMobile, { props: { workshopInBuild } })
  await user.click(screen.getByRole('button', { name: 'Toggle menu' }))
}

describe('HeaderMainMobile', () => {
  it('omits Models when the workshop is not in the build', async () => {
    await openMenu(false)

    expect(screen.queryByRole('link', { name: /^Models\b/i })).toBeNull()
  })

  it('offers Models when the workshop is in the build', async () => {
    await openMenu(true)

    expect(screen.getByRole('link', { name: /^Models\b/i })).toBeTruthy()
  })
})
