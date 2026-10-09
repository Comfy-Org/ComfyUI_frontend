import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { HubSections } from '@/data/mainNavigation'
import HeaderMainDesktop from './HeaderMainDesktop.vue'

const ALL_SECTIONS: HubSections = { workflows: true, apps: true }

async function openHub(hubSections: HubSections = ALL_SECTIONS) {
  history.replaceState(null, '', '/pricing')
  render(HeaderMainDesktop, { props: { hubSections } })
  await userEvent.click(screen.getByRole('button', { name: /^Hub\b/ }))
  const menu = within(await screen.findByTestId('nav-dropdown'))
  await menu.findAllByRole('link')
  return menu
}

describe('HeaderMainDesktop', () => {
  it('renders Hub, Products and Enterprise at the top level', () => {
    render(HeaderMainDesktop)
    for (const name of [/^Hub\b/, /^Products\b/, /^Enterprise\b/])
      expect(screen.getByRole('button', { name })).toBeTruthy()
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
      ['Seedance 2.5', '/hub/models/seedance-2-5-reference-to-video/']
    ])
    expect(linksIn('Workflows')).toEqual([
      ['Image to video', '/hub/workflows/image-to-video/'],
      ['Video from references', '/hub/workflows/video-from-references/']
    ])
    expect(linksIn('Apps')).toEqual([
      ['Cinematic Studio', '/hub/apps/cinematic-studio/'],
      ['Re-shoot', '/hub/apps/reshoot/']
    ])
    expect(linksIn('Browse')).toEqual([
      ['All models', '/hub/models/'],
      ['All workflows', '/hub/workflows/'],
      ['All apps', '/hub/apps/']
    ])
  })

  it('features Seedance 2.5 with a Try now link to its model page', async () => {
    const menu = await openHub()

    expect(
      menu.getByRole('link', {
        name: 'Try Seedance 2.5 reference to video in the Hub'
      })
    ).toHaveAttribute('href', '/hub/models/seedance-2-5-reference-to-video/')
    expect(menu.getByText('Try now')).toBeVisible()
  })

  it('opens each app in a tab of its own, and the apps list in this one', async () => {
    const menu = await openHub()

    for (const name of ['Cinematic Studio', 'Re-shoot']) {
      const link = menu.getByRole('link', { name })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener')
    }
    for (const name of ['All apps', 'Seedance 2.5'])
      expect(menu.getByRole('link', { name })).not.toHaveAttribute('target')
  })

  it('leaves the sections that are off out of the columns and the Browse row', async () => {
    const menu = await openHub({ workflows: false, apps: false })

    expect(menu.queryByRole('list', { name: 'Workflows' })).toBeNull()
    expect(menu.queryByRole('list', { name: 'Apps' })).toBeNull()
    expect(
      within(menu.getByRole('list', { name: 'Browse' }))
        .getAllByRole('link')
        .map((link) => link.textContent.trim())
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
