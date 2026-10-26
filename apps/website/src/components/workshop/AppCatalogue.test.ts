import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import AppCatalogue from './AppCatalogue.vue'

function appsOf(count: number): CatalogueApp[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `app-${index}`,
    name: `App ${index}`,
    task: `Task ${index}`,
    href: `/apps/${index}`
  }))
}

describe('AppCatalogue', () => {
  it.for([2, 8, 12])(
    'lists all %i apps in one grid with nothing to browse into',
    (count) => {
      render(AppCatalogue, { props: { apps: appsOf(count) } })
      expect(
        within(screen.getByTestId('app-grid')).getAllByRole('link')
      ).toHaveLength(count)
      expect(screen.queryByRole('button')).toBeNull()
    }
  )

  it.for([
    { locale: 'en', mark: 'CComfy app' },
    { locale: 'zh-CN', mark: 'CComfy 应用' }
  ] as const)('labels every card in $locale', ({ locale, mark }) => {
    render(AppCatalogue, { props: { apps: appsOf(9), locale } })

    expect(
      within(screen.getByTestId('app-grid'))
        .getAllByTestId('model-card-provider')
        .map((element) => element.textContent.trim())
    ).toEqual(Array(9).fill(mark))
  })
})
