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
  it('reports which app was opened and where it sat in the grid', async () => {
    const user = userEvent.setup()
    render(AppCatalogue, { props: { apps } })

    await user.click(
      within(screen.getByTestId('app-grid')).getAllByRole('link')[8]
    )
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith(
      clicked('apps/app-8', 'app_row', 8)
    )
  })
})
