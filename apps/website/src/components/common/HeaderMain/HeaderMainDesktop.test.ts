import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { HubSections } from '@/data/mainNavigation'
import HeaderMainDesktop from './HeaderMainDesktop.vue'

const ALL_SECTIONS: HubSections = { workflows: true, apps: true }

async function openMenu(
  name: RegExp,
  {
    path = '/pricing',
    workshopInBuild = true,
    hubSections = ALL_SECTIONS
  }: {
    path?: string
    workshopInBuild?: boolean
    hubSections?: HubSections
  } = {}
) {
  history.replaceState(null, '', path)
  render(HeaderMainDesktop, { props: { workshopInBuild, hubSections } })
  const trigger = screen.getByRole('button', { name })
  await userEvent.click(trigger)
  const menu = within(await screen.findByTestId('nav-dropdown'))
  await menu.findAllByRole('link')
  return { trigger, menu }
}

describe('HeaderMainDesktop', () => {
  it('has no Hub menu without a build opt-in', () => {
    render(HeaderMainDesktop)
    expect(screen.queryByRole('button', { name: /^Hub/ })).toBeNull()
  })

  it('opens the Hub as Models, Workflows and Apps with an Explore row', async () => {
    const { menu } = await openMenu(/^Hub/)

    const icons = menu.getAllByTestId('nav-kind-icon')
    expect(icons.map((icon) => icon.getAttribute('data-kind'))).toEqual([
      'model',
      'workflow',
      'app'
    ])
    for (const [index, header] of ['Models', 'Workflows', 'Apps'].entries()) {
      expect(menu.getByText(header, { exact: true })).toContainElement(
        icons[index]
      )
    }
    expect(menu.queryAllByRole('img')).toHaveLength(0)
    expect(
      [
        'Browse models',
        'All workflows',
        'Cinematic Studio',
        'Re-shoot',
        'All apps'
      ].map((name) => menu.getByRole('link', { name }).getAttribute('href'))
    ).toEqual([
      '/hub/models/',
      '/hub/workflows/',
      '/hub/apps/cinematic-studio/',
      '/hub/apps/reshoot/',
      '/hub/apps/'
    ])
    const docs = menu.getByRole('link', { name: 'API docs' })
    expect(docs).toHaveAttribute('target', '_blank')
    expect(
      menu.getByRole('link', { name: /^Explore the Hub/ })
    ).toHaveAttribute('href', '/hub/')
  })

  it('hides the Hub columns whose sections are off', async () => {
    const { menu } = await openMenu(/^Hub/, {
      hubSections: { workflows: false, apps: false }
    })

    expect(menu.getByRole('link', { name: 'Browse models' })).toBeTruthy()
    expect(menu.queryByRole('link', { name: 'All workflows' })).toBeNull()
    expect(menu.queryByRole('link', { name: 'All apps' })).toBeNull()
  })

  it.for([true, false])(
    'keeps the Hub out of Products (workshop in build: %s)',
    async (workshopInBuild) => {
      const { menu } = await openMenu(/^products/i, { workshopInBuild })

      const hrefs = menu
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
      expect(hrefs).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^\/hub\//)])
      )
      expect(
        menu.queryByRole('link', { name: 'Supported Models' }) === null
      ).toBe(workshopInBuild)
    }
  )

  it('opens Enterprise as one column with no Resources row', async () => {
    const { menu } = await openMenu(/^enterprise/i)

    expect(
      menu.getAllByRole('link').map((link) => link.textContent.trim())
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
    { path: '/hub/models/', hub: true, products: false },
    { path: '/hub/workflows/relight/', hub: true, products: false },
    { path: '/platform/', hub: false, products: true },
    { path: '/pricing', hub: false, products: false }
  ])(
    'marks the Hub or Products active on $path',
    async ({ path, hub, products }) => {
      history.replaceState(null, '', path)
      render(HeaderMainDesktop, {
        props: { workshopInBuild: true, hubSections: ALL_SECTIONS }
      })
      await nextTick()

      expect([
        screen
          .getByRole('button', { name: /^Hub/ })
          .hasAttribute('data-active'),
        screen
          .getByRole('button', { name: /^Products/ })
          .hasAttribute('data-active')
      ]).toEqual([hub, products])
    }
  )
})
