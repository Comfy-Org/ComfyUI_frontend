import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { captureWorkshopEvent } from '@/scripts/posthog'
import {
  FakeIntersectionObserver,
  setAllIntersecting,
  stubIntersectionObserver
} from '@/test/fakeIntersectionObserver'
import HubAppCatalogue from './HubAppCatalogue.vue'

vi.mock(import('@/scripts/posthog'))

const apps: CatalogueApp[] = [
  {
    key: 'apps/cinematic-studio',
    name: 'Cinematic Studio',
    task: 'Direct your shot like a film set',
    href: '/hub/apps/cinematic-studio/'
  },
  {
    key: 'apps/reshoot',
    name: 'Re-shoot a video',
    task: 'Re-shoot from any angle',
    href: '/hub/apps/reshoot/'
  }
]

const UPCOMING_EN = [
  'Move anything',
  'Relight',
  'Hand product swap',
  'Background Removal',
  'Virtual try-on',
  'Sprite Sheet Generator',
  'Paparazzi me'
]

beforeEach(() => {
  stubIntersectionObserver()
})

const cardNamed = (name: string) =>
  screen
    .getAllByTestId('workshop-app-card')
    .find((card) => within(card).queryByRole('heading', { name }))

describe('HubAppCatalogue', () => {
  it('opens a live app in a new tab and lists the apps still being built after it', () => {
    render(HubAppCatalogue, { props: { apps } })

    const studio = screen.getByRole('link', { name: /Cinematic Studio/ })
    expect(studio).toHaveAttribute('href', '/hub/apps/cinematic-studio/')
    expect(studio).toHaveAttribute('target', '_blank')
    expect(studio).toHaveAttribute('rel', 'noopener')
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    ).toEqual(['Cinematic Studio', 'Re-shoot a video', ...UPCOMING_EN])
  })

  it.for([
    { name: 'Cinematic Studio', status: 'Open' },
    { name: 'Relight', status: 'Soon' }
  ])('badges $name as $status', ({ name, status }) => {
    render(HubAppCatalogue, { props: { apps } })

    expect(
      within(cardNamed(name)!).getByTestId('app-card-status')
    ).toHaveTextContent(status)
  })

  it('names the grid for readers who move by heading', () => {
    render(HubAppCatalogue, { props: { apps } })

    expect(screen.getByRole('heading', { level: 2, name: 'Apps' })).toBeTruthy()
  })

  it('writes the apps still being built in Chinese on the Chinese page', () => {
    render(HubAppCatalogue, { props: { apps: [], locale: 'zh-CN' } })

    expect(screen.getByRole('heading', { name: '重新布光' })).toBeTruthy()
  })

  it('reports an opened app from the Hub grid and ignores the ones still being built', async () => {
    const user = userEvent.setup()
    render(HubAppCatalogue, { props: { apps } })

    await user.click(cardNamed('Relight')!)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()

    const reshoot = screen.getByRole('link', { name: /Re-shoot a video/ })
    reshoot.addEventListener('click', (event) => event.preventDefault(), {
      once: true
    })
    await user.click(reshoot)
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'hub_item_clicked',
      properties: {
        surface: 'apps',
        kind: 'app',
        slug: 'apps/reshoot',
        source: 'app_grid',
        position: 1
      }
    })
  })

  it('reports only the apps a visitor can open once the grid scrolls into view', async () => {
    render(HubAppCatalogue, { props: { apps } })

    await setAllIntersecting(true)

    expect(FakeIntersectionObserver.instances[0].observed).toEqual([
      screen.getByTestId('app-grid-row')
    ])
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'hub_row_viewed',
      properties: {
        surface: 'apps',
        source: 'app_grid',
        item_count: 2,
        row_slugs: ['apps/cinematic-studio', 'apps/reshoot']
      }
    })
  })
})
