import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import AppCatalogue from './AppCatalogue.vue'

function appsOf(count: number): CatalogueApp[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `app-${index}`,
    name: `App ${index}`,
    summary: `Summary ${index}`,
    href: `/apps/${index}`
  }))
}

describe('AppCatalogue', () => {
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
