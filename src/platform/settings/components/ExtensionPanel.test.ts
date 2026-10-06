import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import ExtensionPanel from './ExtensionPanel.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { g: { all: 'All', core: 'Core', custom: 'Custom' } }
  }
})

describe('ExtensionPanel', () => {
  it('preserves the selected filter when clicked again', async () => {
    const user = userEvent.setup()
    render(ExtensionPanel, {
      global: {
        plugins: [i18n],
        stubs: {
          SearchInput: true,
          Message: true,
          DataTable: true,
          Column: true
        }
      }
    })

    const coreFilter = screen.getByRole('button', { name: 'Core' })
    await user.click(coreFilter)
    await user.click(coreFilter)

    expect(coreFilter).toHaveAttribute('aria-pressed', 'true')
  })
})
