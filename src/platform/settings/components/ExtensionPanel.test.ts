import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useExtensionStore } from '@/stores/extensionStore'

import ExtensionPanel from './ExtensionPanel.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        all: 'All',
        core: 'Core',
        custom: 'Custom',
        disableAll: 'Disable all',
        disableSelected: 'Disable selected',
        disableThirdParty: 'Disable third-party extensions',
        enableAll: 'Enable all',
        enableSelected: 'Enable selected',
        extensionName: 'Extension name',
        extensions: 'Extensions',
        moreOptions: 'More options',
        reloadToApplyChanges: 'Reload to apply changes',
        searchPlaceholder: 'Search {subject}...',
        selectAll: 'Select all'
      }
    }
  }
})

describe('ExtensionPanel', () => {
  it('keeps individual and filtered bulk selections', async () => {
    const user = userEvent.setup()
    const extensionStore = useExtensionStore()
    extensionStore.registerExtension({ name: 'Alpha' })
    extensionStore.registerExtension({ name: 'Zebra' })

    render(ExtensionPanel, { global: { plugins: [i18n] } })

    await user.click(screen.getByRole('checkbox', { name: 'Alpha' }))
    await user.type(screen.getByRole('combobox'), 'Zebra')
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    await user.clear(screen.getByRole('combobox'))

    expect(screen.getByRole('checkbox', { name: 'Alpha' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Zebra' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeChecked()
  })
})
