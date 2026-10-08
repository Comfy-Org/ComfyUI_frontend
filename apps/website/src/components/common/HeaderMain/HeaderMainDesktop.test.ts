import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { HubMenuPreviews, HubSections } from '@/data/mainNavigation'
import HeaderMainDesktop from './HeaderMainDesktop.vue'

const ALL_SECTIONS: HubSections = { workflows: true, apps: true }
const GATED_HUB_LINK = /^\/hub\/(?!models\/local\/)/

async function openMenu(
  name: RegExp,
  {
    path = '/pricing',
    workshopInBuild = true,
    hubSections = ALL_SECTIONS,
    hubPreviews
  }: {
    path?: string
    workshopInBuild?: boolean
    hubSections?: HubSections
    hubPreviews?: HubMenuPreviews
  } = {}
) {
  history.replaceState(null, '', path)
  render(HeaderMainDesktop, {
    props: { workshopInBuild, hubSections, hubPreviews }
  })
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

    for (const header of ['Models', 'Workflows', 'Apps']) {
      expect(menu.getByText(header, { exact: true })).toBeVisible()
    }
    expect(menu.queryByTestId('nav-kind-icon')).toBeNull()
    expect(menu.queryAllByRole('img')).toHaveLength(0)
    expect(
      [
        'Seedream 5.0 Pro',
        'Seedance 2.5',
        'Nano Banana 2',
        'GPT Image 2',
        'All models',
        'Change material',
        'Match lighting',
        'All workflows',
        'Cinematic Studio',
        'Re-shoot',
        'All apps'
      ].map((name) => menu.getByRole('link', { name }).getAttribute('href'))
    ).toEqual([
      '/hub/models/seedream-5-0-pro-text-to-image/',
      '/hub/models/seedance-2-5-reference-to-video/',
      '/hub/models/nano-banana-2-image-edit/',
      '/hub/models/gpt-image-2-text-to-image/',
      '/hub/models/',
      '/hub/workflows/change-material/',
      '/hub/workflows/match-lighting/',
      '/hub/workflows/',
      '/hub/apps/cinematic-studio/',
      '/hub/apps/reshoot/',
      '/hub/apps/'
    ])
    expect(
      menu.getByRole('link', { name: /^Explore the Hub/ })
    ).toHaveAttribute('href', '/hub/')
  })

  it('leads the Hub with its intro and Explore link, above the columns', async () => {
    const { menu } = await openMenu(/^Hub/)
    const row = menu.getByTestId('nav-explore-row')

    expect(row).toHaveTextContent(
      'Try in the browser, call by API, or take it into ComfyUI'
    )
    expect(
      within(row).getByRole('link', { name: 'Explore the Hub' })
    ).toHaveAttribute('href', '/hub/')
    expect(
      row.compareDocumentPosition(menu.getByText('Models', { exact: true }))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows each Hub example with its catalogue still and a line about it', async () => {
    const { menu } = await openMenu(/^Hub/, {
      hubPreviews: {
        '/hub/models/seedream-5-0-pro-text-to-image/': {
          thumbnail: 'https://media.comfy.org/seedream.png',
          meta: 'ByteDance · Image'
        },
        '/hub/models/seedance-2-5-reference-to-video/': {
          meta: 'ByteDance · Video'
        }
      }
    })
    const seedream = menu.getByRole('link', { name: /^Seedream 5\.0 Pro/ })
    const seedance = menu.getByRole('link', { name: /^Seedance 2\.5/ })

    expect(seedream).toHaveTextContent('ByteDance · Image')
    expect(
      within(seedream).getByTestId('nav-item-thumb').getAttribute('src')
    ).toBe('https://media.comfy.org/seedream.png')
    expect(seedance).toHaveTextContent('ByteDance · Video')
    expect(within(seedance).queryByTestId('nav-item-thumb')).toBeNull()
    expect(
      within(seedance).getByTestId('nav-item-thumb-placeholder')
    ).toBeTruthy()
    expect(
      within(menu.getByRole('link', { name: 'All models' })).queryByTestId(
        'nav-item-thumb-placeholder'
      )
    ).toBeNull()
  })

  it('opens each app in a tab of its own, and the apps list in this one', async () => {
    const { menu } = await openMenu(/^Hub/)

    for (const name of ['Cinematic Studio', 'Re-shoot']) {
      const link = menu.getByRole('link', { name })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener')
    }
    for (const name of ['All apps', 'Change material', 'Seedance 2.5'])
      expect(menu.getByRole('link', { name })).not.toHaveAttribute('target')
  })

  it('leaves the API key and docs links to the Models page', async () => {
    const { menu } = await openMenu(/^Hub/)

    expect(menu.queryByRole('link', { name: /API/ })).toBeNull()
  })

  it('hides the Hub columns whose sections are off', async () => {
    const { menu } = await openMenu(/^Hub/, {
      hubSections: { workflows: false, apps: false }
    })

    expect(menu.getByRole('link', { name: 'All models' })).toBeVisible()
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
        expect.arrayContaining([expect.stringMatching(GATED_HUB_LINK)])
      )
      expect(
        menu.queryByRole('link', { name: 'Supported Models' }) === null
      ).toBe(workshopInBuild)
    }
  )

  it('ends Products with the Resources row and shows its card after the columns', async () => {
    const { menu } = await openMenu(/^products/i)

    const links = menu.getAllByRole('link')
    expect(links.slice(-4, -1).map((link) => link.textContent.trim())).toEqual([
      'Docs',
      'Comfy SDKs',
      'Launches'
    ])
    expect(links.at(-1)).toHaveAttribute('href', '/gemini-omni/')
    expect(menu.queryByRole('link', { name: 'GitHub' })).toBeNull()
  })

  it('shows the Company columns and its card after them, with no social links', async () => {
    const { menu } = await openMenu(/^company/i)

    for (const header of ['Company', 'Updates', 'Community']) {
      expect(menu.getByText(header, { exact: true })).toBeVisible()
    }
    expect(menu.queryByText('Follow us')).toBeNull()
    for (const name of ['GitHub', 'Discord', 'X', 'Instagram'])
      expect(menu.queryByRole('link', { name })).toBeNull()
    expect(menu.getAllByRole('link').at(-1)).toHaveAttribute(
      'href',
      '/customers/videos/black-math/'
    )
  })

  it('opens Enterprise as one column followed by its card, with no Resources row', async () => {
    const { menu } = await openMenu(/^enterprise/i)

    const links = menu.getAllByRole('link')
    expect(links.slice(0, -1).map((link) => link.textContent.trim())).toEqual([
      'Comfy Enterprise',
      'Forward Deployed Creatives',
      'Commercial licensing',
      'Contact sales'
    ])
    expect(links.at(-1)).toHaveAccessibleName(
      'Learn about commercial licensing'
    )
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
