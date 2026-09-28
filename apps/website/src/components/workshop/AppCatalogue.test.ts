import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { AppWorkshopModel } from '../../config/models-catalogue'
import AppCatalogue from './AppCatalogue.vue'

function appsOf(count: number): AppWorkshopModel[] {
  return Array.from({ length: count }, (_, index) => ({
    slug: `app-${index}`,
    name: `App ${index}`,
    workflowCount: 1,
    href: `/apps/${index}`,
    capabilities: [],
    type: 'APP',
    appId: index % 2 ? 'reshoot' : 'studio',
    thumbnail:
      index % 2
        ? undefined
        : { url: `/images/primary-${index}.jpg`, kind: 'image' },
    thumbnailUrl: `/images/fallback-${index}.jpg`
  }))
}

describe('AppCatalogue', () => {
  it('maps app metadata into the visible catalogue cards', () => {
    render(AppCatalogue, { props: { apps: appsOf(2) } })
    const [studio, reshoot] = screen.getAllByTestId('workshop-app-card')

    expect(studio).toHaveAttribute('href', '/apps/0')
    expect(within(studio).getByTestId('app-card-task')).toHaveTextContent(
      'Image to Video'
    )
    expect(within(studio).getByRole('img', { hidden: true })).toHaveAttribute(
      'src',
      '/images/primary-0.jpg'
    )

    expect(reshoot).toHaveAttribute('href', '/apps/1')
    expect(within(reshoot).getByTestId('app-card-task')).toHaveTextContent(
      'Video to Video'
    )
    expect(within(reshoot).getByRole('img', { hidden: true })).toHaveAttribute(
      'src',
      '/images/fallback-1.jpg'
    )
  })

  it.for([
    { count: 2, browseAll: 0 },
    { count: 8, browseAll: 0 },
    { count: 9, browseAll: 1 }
  ])(
    'offers Browse all apps only when $count apps outgrow the shelf',
    ({ count, browseAll }) => {
      render(AppCatalogue, { props: { apps: appsOf(count) } })
      expect(
        within(screen.getByTestId('app-shelf')).getAllByRole('link')
      ).toHaveLength(Math.min(count, 8))
      expect(
        screen.queryAllByRole('button', { name: /Browse all apps/ })
      ).toHaveLength(browseAll)
    }
  )

  it('opens every app and leads back to the shelf', async () => {
    const user = userEvent.setup()
    const { emitted } = render(AppCatalogue, { props: { apps: appsOf(9) } })

    await user.click(screen.getByRole('button', { name: /Browse all apps/ }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'All apps 9'
    )
    expect(
      within(screen.getByTestId('app-search-results')).getAllByRole('link')
    ).toHaveLength(9)

    await user.click(screen.getByTestId('section-back'))
    expect(screen.getByTestId('app-shelf')).toBeVisible()
    expect(emitted<[boolean]>('section').map(([value]) => value)).toEqual([
      false,
      true,
      false
    ])
  })
})
