import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import TabGlobalParameters from './TabGlobalParameters.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { searchPlaceholder: 'Search', clear: 'Clear' },
      rightSidePanel: { favorites: 'Favorites', favoritesNone: 'No favorites' }
    }
  }
})

function renderTab() {
  return render(TabGlobalParameters, {
    global: {
      plugins: [i18n],
      stubs: { SectionWidgets: true }
    }
  })
}

describe('TabGlobalParameters', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('renders the shared search header', () => {
    renderTab()

    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})
