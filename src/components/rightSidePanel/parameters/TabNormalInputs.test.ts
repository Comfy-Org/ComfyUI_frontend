import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import TabNormalInputs from './TabNormalInputs.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { searchPlaceholder: 'Search', clear: 'Clear' },
      rightSidePanel: { advanced: 'Advanced', inputsNone: 'None' }
    }
  }
})

const CollapseToggleButtonStub = {
  props: ['modelValue', 'show'],
  template: '<button data-testid="collapse-toggle" />'
}

function renderTab() {
  return render(TabNormalInputs, {
    props: { nodes: [] },
    global: {
      plugins: [i18n],
      stubs: {
        SectionWidgets: true,
        CollapseToggleButton: CollapseToggleButtonStub
      }
    }
  })
}

describe('TabNormalInputs', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('composes the shared search header with the collapse toggle in its slot', () => {
    renderTab()

    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(screen.getByTestId('collapse-toggle')).toBeTruthy()
  })
})
