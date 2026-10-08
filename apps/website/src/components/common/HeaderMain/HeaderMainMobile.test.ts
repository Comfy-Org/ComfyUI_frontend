import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { HubMenuPreviews } from '@/data/mainNavigation'
import HeaderMainMobile from './HeaderMainMobile.vue'

async function openMenu(
  workshopInBuild: boolean,
  hubPreviews?: HubMenuPreviews
) {
  const user = userEvent.setup()
  render(HeaderMainMobile, {
    props: {
      workshopInBuild,
      hubSections: { workflows: true, apps: true },
      hubPreviews
    }
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
    const user = await openMenu(true, {
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

  it('ends the Company drill-down without the social links', async () => {
    const user = await openMenu(false)
    await user.click(screen.getByRole('button', { name: /^Company/ }))

    expect(screen.getByRole('link', { name: 'Affiliates' })).toBeTruthy()
    for (const name of ['GitHub', 'Discord', 'X', 'Instagram'])
      expect(screen.queryByRole('link', { name })).toBeNull()
  })

  it('labels a new top-level section with a NEW badge', async () => {
    await openMenu(false)

    expect(
      screen.getByRole('button', { name: /^Products\s*NEW$/i })
    ).toBeTruthy()
  })
})
