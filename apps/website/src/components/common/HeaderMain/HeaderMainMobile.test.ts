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
  it.for([
    { build: 'in', workshopInBuild: true, hub: '/hub/' },
    { build: 'not in', workshopInBuild: false, hub: undefined }
  ])(
    'offers Explore the Hub under Products when the workshop is $build the build',
    async ({ workshopInBuild, hub }) => {
      await openMenu(workshopInBuild)
      await userEvent.click(screen.getByRole('button', { name: /^Products/ }))

      expect(
        screen
          .queryByRole('link', { name: 'Explore the Hub' })
          ?.getAttribute('href')
      ).toBe(hub)
    }
  )

  it('labels a new top-level section with a NEW badge', async () => {
    await openMenu(false)

    expect(
      screen.getByRole('button', { name: /^Products\s*NEW$/i })
    ).toBeTruthy()
  })
})
