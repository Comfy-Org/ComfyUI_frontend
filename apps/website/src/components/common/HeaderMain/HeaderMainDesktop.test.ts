import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { HubMenuPreviews, HubSections } from '@/data/mainNavigation'
import HeaderMainDesktop from './HeaderMainDesktop.vue'

const ALL_SECTIONS: HubSections = { workflows: true, apps: true }

async function openMenu(
  name: RegExp,
  {
    path = '/pricing',
    hubSections = ALL_SECTIONS,
    hubPreviews
  }: {
    path?: string
    hubSections?: HubSections
    hubPreviews?: HubMenuPreviews
  } = {}
) {
  history.replaceState(null, '', path)
  render(HeaderMainDesktop, {
    props: { hubSections, hubPreviews }
  })
  const trigger = screen.getByRole('button', { name })
  await userEvent.click(trigger)
  const menu = within(await screen.findByTestId('nav-dropdown'))
  await menu.findAllByRole('link')
  return { trigger, menu }
}

describe('HeaderMainDesktop', () => {
  it('renders Hub, Products and Enterprise at the top level', () => {
    render(HeaderMainDesktop)
    for (const name of [/^Hub\b/, /^Products\b/, /^Enterprise\b/])
      expect(screen.getByRole('button', { name })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /community/i })).toBeNull()
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

  it('shows each Hub example with a line about it and no image', async () => {
    const { menu } = await openMenu(/^Hub/, {
      hubPreviews: {
        '/hub/models/seedream-5-0-pro-text-to-image/': {
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
    expect(seedance).toHaveTextContent('ByteDance · Video')
    expect(menu.queryAllByRole('img')).toHaveLength(0)
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

  it('opens Products with its card before the columns and ends with the Resources row', async () => {
    const { menu } = await openMenu(/^products/i)

    const links = menu.getAllByRole('link')
    expect(links.at(0)).toHaveAttribute('href', '/gemini-omni/')
    expect(links.slice(-2).map((link) => link.textContent.trim())).toEqual([
      'Docs',
      'Comfy SDKs'
    ])
    expect(menu.getByRole('link', { name: /^Browse Models/ })).toHaveAttribute(
      'href',
      '/hub/models/'
    )
    expect(menu.queryByRole('link', { name: 'Supported Models' })).toBeNull()
  })

  it('folds Community into Company, with its card first and social icons last', async () => {
    const { menu } = await openMenu(/^company/i)

    for (const header of ['Community', 'Company', 'Updates', 'Connect']) {
      expect(menu.getByText(header, { exact: true })).toBeVisible()
    }
    expect(menu.getAllByRole('link').at(0)).toHaveAttribute(
      'href',
      '/customers/videos/black-math/'
    )
    for (const name of ['Discord', 'GitHub', 'YouTube', 'X', 'Instagram'])
      expect(
        menu.getByRole('link', { name: new RegExp(`^${name}\\b`) })
      ).toHaveAttribute('target', '_blank')
  })

  it('opens Enterprise with its card followed by one column', async () => {
    const { menu } = await openMenu(/^enterprise/i)

    const links = menu.getAllByRole('link')
    expect(links.at(0)).toHaveAttribute('href', '/minimax/license/')
    expect(links.slice(1).map((link) => link.textContent.trim())).toEqual([
      'Comfy Enterprise',
      'Forward Deployed Creatives',
      'Team Billing',
      'Commercial Licensing',
      'Contact Sales'
    ])
    expect(menu.queryByText('Resources')).toBeNull()
  })

  it.for([
    { path: '/hub/', hub: true, products: false },
    { path: '/hub/models/', hub: true, products: false },
    {
      path: '/hub/models/seedance-2-5-reference-to-video/',
      hub: true,
      products: false
    },
    { path: '/hub/workflows/relight/', hub: true, products: false },
    { path: '/platform/', hub: false, products: true },
    { path: '/pricing', hub: false, products: false }
  ])(
    'marks the Hub or Products active on $path',
    async ({ path, hub, products }) => {
      history.replaceState(null, '', path)
      render(HeaderMainDesktop, {
        props: { hubSections: ALL_SECTIONS }
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
