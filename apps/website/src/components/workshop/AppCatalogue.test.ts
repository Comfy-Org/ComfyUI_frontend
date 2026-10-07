import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import AppCatalogue from './AppCatalogue.vue'

function appsOf(count: number, prefix = 'app'): CatalogueApp[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${prefix}-${index}`,
    name: `${prefix} ${index}`,
    task: `Task ${index}`,
    href: `/apps/${prefix}-${index}/`
  }))
}

describe('AppCatalogue', () => {
  it('lists every open app, then the ones coming soon, in one grid', () => {
    render(AppCatalogue, {
      props: { apps: appsOf(2, 'open'), upcoming: appsOf(9, 'soon') }
    })
    const grid = screen.getByRole('list', { name: 'Apps' })

    expect(within(grid).getAllByRole('listitem')).toHaveLength(11)
    expect(within(grid).getAllByRole('link')).toHaveLength(2)
    expect(
      within(grid)
        .getAllByTestId('workshop-app-card')
        .map((card) => card.dataset.soon ?? 'open')
    ).toEqual([...Array(2).fill('open'), ...Array(9).fill('true')])
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('puts no featured app ahead of the list', () => {
    render(AppCatalogue, { props: { apps: appsOf(2) } })
    expect(screen.queryByTestId('app-featured')).toBeNull()
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
  })

  it('says what each open app makes under its summary', () => {
    render(AppCatalogue, {
      props: {
        apps: [
          {
            key: 'apps/reshoot',
            name: 'Re-shoot a video',
            task: 'Re-frame a shot',
            href: '/hub/apps/reshoot/'
          }
        ]
      }
    })
    expect(screen.getByRole('link')).toHaveTextContent('Video · MiniMax H3')
  })
})
