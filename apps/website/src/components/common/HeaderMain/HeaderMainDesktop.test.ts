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

  it('opens the Hub as Models, Workflows and Apps', async () => {
    const menu = await openHub()

    for (const header of ['Models', 'Workflows', 'Apps'])
      expect(menu.getByText(header, { exact: true })).toBeVisible()
    expect(
      [
        'Seedream 5.0 Pro',
        'Seedance 2.5',
        'All models',
        'Turn an image into a video',
        'Create a video from references',
        'All workflows',
        'Cinematic Studio',
        'Re-shoot',
        'All apps'
      ].map((name) => menu.getByRole('link', { name }).getAttribute('href'))
    ).toEqual([
      '/hub/models/seedream-5-0-pro-text-to-image/',
      '/hub/models/seedance-2-5-reference-to-video/',
      '/hub/models/',
      '/hub/workflows/image-to-video/',
      '/hub/workflows/video-from-references/',
      '/hub/workflows/',
      '/hub/apps/cinematic-studio/',
      '/hub/apps/reshoot/',
      '/hub/apps/'
    ])
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

  it('hides the Hub columns whose sections are off', async () => {
    const menu = await openHub({ workflows: false, apps: false })

    expect(menu.getByRole('link', { name: 'All models' })).toBeVisible()
    expect(menu.queryByRole('link', { name: 'All workflows' })).toBeNull()
    expect(menu.queryByRole('link', { name: 'All apps' })).toBeNull()
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
