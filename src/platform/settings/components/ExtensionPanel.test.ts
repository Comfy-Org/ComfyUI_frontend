import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
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
  it('preserves the selected filter when clicked again', async () => {
    const user = userEvent.setup()
    render(ExtensionPanel, { global: { plugins: [i18n] } })

    const coreFilter = screen.getByRole('button', { name: 'Core' })
    await user.click(coreFilter)
    await user.click(coreFilter)

    expect(coreFilter).toHaveAttribute('aria-pressed', 'true')
  })

  it('sorts by extension name and exposes the order through aria-sort', async () => {
    const user = userEvent.setup()
    const extensionStore = useExtensionStore()
    extensionStore.registerExtension({ name: 'Zebra' })
    extensionStore.registerExtension({ name: 'Alpha' })

    render(ExtensionPanel, { global: { plugins: [i18n] } })

    const header = screen.getByRole('columnheader', { name: 'Extension name' })
    const names = () =>
      screen
        .getAllByRole('checkbox', { name: /^(Alpha|Zebra)$/ })
        .map((checkbox) => checkbox.getAttribute('aria-label'))

    expect(header).toHaveAttribute('aria-sort', 'ascending')
    expect(names()).toEqual(['Alpha', 'Zebra'])

    await user.click(screen.getByRole('button', { name: 'Extension name' }))

    expect(header).toHaveAttribute('aria-sort', 'descending')
    expect(names()).toEqual(['Zebra', 'Alpha'])
  })

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

  it('toggles only the selected extensions and offers a reload while they differ', async () => {
    const user = userEvent.setup()
    const extensionStore = useExtensionStore()
    extensionStore.registerExtension({ name: 'Alpha' })
    extensionStore.registerExtension({ name: 'Zebra' })
    const setSetting = vi.spyOn(useSettingStore(), 'set').mockResolvedValue()
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

    render(ExtensionPanel, { global: { plugins: [i18n] } })
    await user.click(screen.getByRole('checkbox', { name: 'Alpha' }))
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Disable selected' })
    )

    expect(screen.getByRole('switch', { name: 'Alpha' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Zebra' })).toBeChecked()
    expect(setSetting).toHaveBeenLastCalledWith('Comfy.Extension.Disabled', [
      'Alpha'
    ])
    await user.click(
      screen.getByRole('button', { name: 'Reload to apply changes' })
    )
    expect(reload).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Enable selected' })
    )

    expect(screen.getByRole('switch', { name: 'Alpha' })).toBeChecked()
    expect(setSetting).toHaveBeenLastCalledWith('Comfy.Extension.Disabled', [])
    expect(
      screen.queryByRole('button', { name: 'Reload to apply changes' })
    ).not.toBeInTheDocument()
  })
})
