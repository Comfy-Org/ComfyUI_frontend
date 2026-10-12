import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { captureWorkshopEvent } from '@/scripts/posthog'
import AppCatalogue from './AppCatalogue.vue'

vi.mock(import('@/scripts/posthog'))

const apps: CatalogueApp[] = Array.from({ length: 9 }, (_, index) => ({
  key: `apps/app-${index}`,
  name: `App ${index}`,
  task: `Task ${index}`,
  href: `/hub/apps/app-${index}/`
}))

const clicked = (slug: string, source: string, position: number) => ({
  name: 'hub_item_clicked',
  properties: { surface: 'apps', kind: 'app', slug, source, position }
})

describe('AppCatalogue analytics', () => {
  it('reports which app was opened from the shelf and from Browse all', async () => {
    const user = userEvent.setup()
    render(AppCatalogue, { props: { apps } })

    await user.click(
      within(screen.getByTestId('app-shelf')).getAllByRole('link')[2]
    )
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith(
      clicked('apps/app-2', 'app_row', 2)
    )

    await user.click(screen.getByRole('button', { name: /Browse all apps/ }))
    await user.click(
      within(screen.getByTestId('app-search-results')).getAllByRole('link')[8]
    )
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith(
      clicked('apps/app-8', 'results_grid', 8)
    )
  })
})
