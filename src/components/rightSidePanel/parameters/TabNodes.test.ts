import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import TabNodes from './TabNodes.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { searchPlaceholder: 'Search', clear: 'Clear' },
      rightSidePanel: { noneSearchDesc: 'None', inputsNoneTooltip: '' }
    }
  }
})

const CollapseToggleButtonStub = {
  props: ['modelValue', 'show'],
  template: '<button data-testid="collapse-toggle" />'
}

function renderTab() {
  return render(TabNodes, {
    global: {
      plugins: [i18n],
      stubs: {
        SectionWidgets: true,
        CollapseToggleButton: CollapseToggleButtonStub
      }
    }
  })
}

describe('TabNodes', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('composes the shared search header with the collapse toggle in its slot', () => {
    renderTab()

    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(screen.getByTestId('collapse-toggle')).toBeTruthy()
  })
})
