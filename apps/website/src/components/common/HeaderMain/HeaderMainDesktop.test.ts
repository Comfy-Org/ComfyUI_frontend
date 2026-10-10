import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { HubSections } from '@/data/mainNavigation'
import HeaderMainDesktop from './HeaderMainDesktop.vue'

const ALL_SECTIONS: HubSections = {
  workflows: true,
  apps: true,
  reshoot: true
}

async function openHub(hubSections: HubSections = ALL_SECTIONS) {
  history.replaceState(null, '', '/pricing')
  render(HeaderMainDesktop, { props: { hubSections } })
  await userEvent.click(screen.getByRole('button', { name: /^Hub\b/ }))
  const menu = within(await screen.findByTestId('nav-dropdown'))
  await menu.findAllByRole('link')
  return menu
}

describe('HeaderMainDesktop', () => {
  it.for([/^Hub\b/, /^Products\b/, /^Enterprise\b/])(
    'renders %s as a top-level menu',
    (name) => {
      render(HeaderMainDesktop)
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  )

  it('has no top-level Community menu', () => {
    render(HeaderMainDesktop)
    expect(screen.queryByRole('button', { name: /community/i })).toBeNull()
  })

  it('opens the Hub as described Models, Workflows and Apps columns', async () => {
    const menu = await openHub()
    const linksIn = (list: string) =>
      within(menu.getByRole('list', { name: list }))
        .getAllByRole('link')
        .map((link) => [link.textContent.trim(), link.getAttribute('href')])

    expect(
      [
        'Run the latest AI models',
        'Ready-made recipes for a task',
        'Full tools built on Comfy'
      ].filter((description) => !menu.queryByText(description))
    ).toEqual([])
    expect(linksIn('Models')).toEqual([
      ['Seedream 5.0 Pro', '/hub/models/seedream-5-0-pro-text-to-image/'],
      ['Seedance 2.5', '/hub/models/seedance-2-5-reference-to-video/'],
      ['Nano Banana 2', '/hub/models/nano-banana-2-image-edit/'],
      ['GPT Image 2', '/hub/models/gpt-image-2-text-to-image/']
    ])
    expect(linksIn('Workflows')).toEqual([
      ['Image to video', '/hub/workflows/image-to-video/'],
      ['Video from references', '/hub/workflows/video-from-references/'],
      ['Motion transfer', '/hub/workflows/motion-transfer/'],
      ['Edit selected region', '/hub/workflows/edit-selected-region/']
    ])
    expect(linksIn('Apps')).toEqual([
      ['Cinematic Studio', '/hub/apps/cinematic-studio/'],
      ['Re-shoot', '/hub/apps/reshoot/']
    ])
  })

  it.for([
    { name: 'All models', href: '/hub/models/', column: 'Models' },
    { name: 'All workflows', href: '/hub/workflows/', column: 'Workflows' },
    { name: 'All apps', href: '/hub/apps/', column: 'Apps' }
  ])(
    'ends the $column column with $name, linking to $href in this tab',
    async ({ name, href, column }) => {
      const menu = await openHub()
      const allLink = menu.getByRole('link', { name })
      const examples = menu.getByRole('list', { name: column })

      expect(allLink).toHaveAttribute('href', href)
      expect(allLink).not.toHaveAttribute('target')
      expect(
        examples.compareDocumentPosition(allLink) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    }
  )

  it('features Seedance 2.5 with a Try now link to its model page', async () => {
    const menu = await openHub()

    expect(
      menu.getByRole('link', {
        name: 'Try Seedance 2.5 reference to video in the Hub'
      })
    ).toHaveAttribute('href', '/hub/models/seedance-2-5-reference-to-video/')
    expect(menu.getByText('Try now')).toBeVisible()
  })

  it.for(['Cinematic Studio', 'Re-shoot'])(
    'opens the %s app in a tab of its own',
    async (name) => {
      const menu = await openHub()
      const link = menu.getByRole('link', { name })

      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener')
    }
  )

  it('leaves the sections that are off and their All links out of the menu', async () => {
    const menu = await openHub({
      workflows: false,
      apps: false,
      reshoot: false
    })

    expect(menu.queryByRole('list', { name: 'Workflows' })).toBeNull()
    expect(menu.queryByRole('list', { name: 'Apps' })).toBeNull()
    expect(
      ['All models', 'All workflows', 'All apps'].filter((name) =>
        menu.queryByRole('link', { name })
      )
    ).toEqual(['All models'])
  })

  it.for([
    { path: '/hub/models/', hub: true, products: false },
    {
      path: '/hub/models/seedance-2-5-reference-to-video/',
      hub: true,
      products: false
    },
    { path: '/hub/workflows/relight/', hub: true, products: false },
    { path: '/hub/apps/', hub: true, products: false },
    { path: '/platform/', hub: false, products: true },
    { path: '/pricing', hub: false, products: false }
  ])(
    'marks the Hub or Products active on $path',
    async ({ path, hub, products }) => {
      history.replaceState(null, '', path)
      render(HeaderMainDesktop, { props: { hubSections: ALL_SECTIONS } })
      await nextTick()

      expect([
        screen
          .getByRole('button', { name: /^Hub\b/ })
          .hasAttribute('data-active'),
        screen
          .getByRole('button', { name: /^Products\b/ })
          .hasAttribute('data-active')
      ]).toEqual([hub, products])
    }
  )
})
