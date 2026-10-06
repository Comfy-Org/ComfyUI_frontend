import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import HeaderMainMobile from './HeaderMainMobile.vue'

async function openMenu(workshopInBuild: boolean) {
  const user = userEvent.setup()
  render(HeaderMainMobile, {
    props: { workshopInBuild, hubSections: { workflows: true, apps: true } }
  })
  await user.click(screen.getByRole('button', { name: 'Toggle menu' }))
  return user
}

describe('HeaderMainMobile', () => {
  it.for([
    {
      build: 'in',
      workshopInBuild: true,
      sections: ['Hub', 'Products', 'Enterprise', 'Company']
    },
    {
      build: 'not in',
      workshopInBuild: false,
      sections: ['Products', 'Enterprise', 'Company']
    }
  ])(
    'opens $sections as sections when the workshop is $build the build',
    async ({ workshopInBuild, sections }) => {
      await openMenu(workshopInBuild)
      const menu = within(screen.getByRole('navigation', { name: 'Menu' }))

      expect(
        menu
          .getAllByRole('button')
          .map((button) => button.textContent.replace(/NEW$/, '').trim())
      ).toEqual(sections)
      expect(menu.getByRole('link', { name: 'Pricing' })).toBeTruthy()
    }
  )

  it('drills into the Hub formats and the Explore row', async () => {
    const user = await openMenu(true)
    await user.click(screen.getByRole('button', { name: /^Hub/ }))

    expect(
      screen.getByText('Run them here, call them by API or download them.')
        .tagName
    ).toBe('P')
    expect(
      screen
        .getAllByTestId('nav-kind-icon')
        .map((icon) => icon.getAttribute('data-kind'))
    ).toEqual(['model', 'workflow', 'app'])
    expect(screen.getByRole('link', { name: 'All workflows' })).toHaveAttribute(
      'href',
      '/hub/workflows/'
    )
    expect(
      screen.getByRole('link', { name: /^Explore the Hub/ })
    ).toHaveAttribute('href', '/hub/')
  })

  it('labels a new top-level section with a NEW badge', async () => {
    await openMenu(false)

    expect(
      screen.getByRole('button', { name: /^Products\s*NEW$/i })
    ).toBeTruthy()
  })
})
