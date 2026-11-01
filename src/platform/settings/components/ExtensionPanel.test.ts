import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { testI18n } from '@/utils/__tests__/testI18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'

import ExtensionPanel from './ExtensionPanel.vue'

function registerExtensions(...names: string[]) {
  const extensionStore = useExtensionStore()
  for (const name of names) extensionStore.registerExtension({ name })
}

function renderPanel() {
  return render(ExtensionPanel, { global: { plugins: [testI18n] } })
}

describe('ExtensionPanel', () => {
  it('preserves the selected filter when clicked again', async () => {
    const user = userEvent.setup()
    renderPanel()

    const coreFilter = screen.getByRole('button', { name: 'Core' })
    await user.click(coreFilter)
    await user.click(coreFilter)

    expect(coreFilter).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps registration order until the name column is sorted', async () => {
    const user = userEvent.setup()
    registerExtensions('Zebra', 'Alpha')
    renderPanel()

    const names = () =>
      screen
        .getAllByRole('switch', { name: /^(Alpha|Zebra)$/ })
        .map((toggle) => toggle.getAttribute('aria-label'))

    expect(
      screen.getByRole('columnheader', { name: 'Extension Name' })
    ).toHaveAttribute('aria-sort', 'none')
    expect(names()).toEqual(['Zebra', 'Alpha'])

    await user.click(screen.getByRole('button', { name: 'Extension Name' }))
    expect(names()).toEqual(['Alpha', 'Zebra'])

    await user.click(screen.getByRole('button', { name: 'Extension Name' }))
    expect(names()).toEqual(['Zebra', 'Alpha'])
  })

  it('shows select all as mixed while only some visible rows are selected', async () => {
    const user = userEvent.setup()
    registerExtensions('Alpha', 'Zebra')
    renderPanel()

    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }))

    expect(
      screen.getByRole('checkbox', { name: 'Select All' })
    ).toBePartiallyChecked()
  })

  it('toggles selection from anywhere on the row, including cell padding, except its enable switch', async () => {
    const user = userEvent.setup()
    registerExtensions('Alpha')
    vi.spyOn(useSettingStore(), 'set').mockResolvedValue()
    renderPanel()
    const checkbox = screen.getByRole('checkbox', { name: 'Select Alpha' })
    const [checkboxCell, nameCell, switchCell] = within(
      screen.getByRole('row', { name: /Alpha Custom/ })
    ).getAllByRole('cell')

    await user.click(nameCell)
    expect(checkbox).toBeChecked()

    await user.click(checkboxCell)
    expect(checkbox).not.toBeChecked()

    await user.click(switchCell)
    expect(checkbox).toBeChecked()

    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()

    await user.click(screen.getByRole('switch', { name: 'Alpha' }))
    expect(checkbox).not.toBeChecked()
  })

  it('replaces the selection with the visible rows on select all and clears it on unselect', async () => {
    const user = userEvent.setup()
    registerExtensions('Alpha', 'Zebra')
    const setSetting = vi.spyOn(useSettingStore(), 'set').mockResolvedValue()
    renderPanel()
    const search = screen.getByRole('combobox')
    const selectAll = () => screen.getByRole('checkbox', { name: 'Select All' })

    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }))
    await user.type(search, 'Zebra')
    await user.click(selectAll())
    await user.clear(search)

    expect(
      screen.getByRole('checkbox', { name: 'Select Alpha' })
    ).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Zebra' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'More Options' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Disable Selected' })
    )
    expect(setSetting).toHaveBeenLastCalledWith('Comfy.Extension.Disabled', [
      'Zebra'
    ])

    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }))
    await user.type(search, 'Zebra')
    await user.click(selectAll())
    await user.clear(search)

    expect(
      screen.getByRole('checkbox', { name: 'Select Alpha' })
    ).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Select Zebra' })
    ).not.toBeChecked()
  })

  it('toggles only the selected extensions and offers a reload while they differ', async () => {
    const user = userEvent.setup()
    registerExtensions('Alpha', 'Zebra')
    const setSetting = vi.spyOn(useSettingStore(), 'set').mockResolvedValue()
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

    renderPanel()
    const moreOptions = screen.getByRole('button', { name: 'More Options' })
    expect(moreOptions).toHaveAttribute('aria-haspopup', 'menu')
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }))
    await user.click(moreOptions)
    await user.click(
      await screen.findByRole('menuitem', { name: 'Disable Selected' })
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

    await user.click(screen.getByRole('button', { name: 'More Options' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Enable Selected' })
    )

    expect(screen.getByRole('switch', { name: 'Alpha' })).toBeChecked()
    expect(setSetting).toHaveBeenLastCalledWith('Comfy.Extension.Disabled', [])
    expect(
      screen.queryByRole('button', { name: 'Reload to apply changes' })
    ).not.toBeInTheDocument()
  })

  it('filters, describes, and disables agent-created extensions', async () => {
    const user = userEvent.setup()
    const extensionStore = useExtensionStore()
    extensionStore.registerExtension({ name: 'Manual.Toolbar' })
    extensionStore.registerExtension({ name: 'agentic.toolbar' })
    extensionStore.registerExtension({ name: 'agent.cushions.toolbar' })
    extensionStore.registerExtension({
      name: 'agent-made.standalone',
      provenance: {
        createdBy: 'comfy-agent',
        summary: 'Adds cushion controls'
      }
    })
    const setSetting = vi.spyOn(useSettingStore(), 'set').mockResolvedValue()

    renderPanel()
    expect(screen.getAllByText('Created by agent')).toHaveLength(2)
    expect(screen.getByText('Adds cushion controls')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Agent-created' }))
    expect(
      screen
        .getAllByRole('switch')
        .map((toggle) => toggle.getAttribute('aria-label'))
    ).toEqual(['agent.cushions.toolbar', 'agent-made.standalone'])

    await user.type(screen.getByRole('combobox'), 'cushions')
    await user.click(screen.getByRole('button', { name: 'More Options' }))
    await user.click(
      await screen.findByRole('menuitem', {
        name: 'Disable all agent-created'
      })
    )

    expect(setSetting).toHaveBeenLastCalledWith('Comfy.Extension.Disabled', [
      'agent.cushions.toolbar',
      'agent-made.standalone'
    ])
    await user.clear(screen.getByRole('combobox'))
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByRole('switch', { name: 'Manual.Toolbar' })).toBeChecked()
    expect(
      screen.getByRole('switch', { name: 'agentic.toolbar' })
    ).toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Reload to apply changes' })
    ).toBeVisible()
  })

  it('labels a core extension created by Agent as created by Agent', () => {
    const extensionStore = useExtensionStore()
    extensionStore.registerExtension({ name: 'agent.cushions.toolbar' })
    extensionStore.captureCoreExtensions()

    renderPanel()

    expect(
      within(
        screen.getByRole('row', { name: /agent\.cushions\.toolbar/ })
      ).getByText('Created by agent')
    ).toBeVisible()
  })

  it('disables the bulk action when all Agent extensions are read-only', async () => {
    const user = userEvent.setup()
    const extensionStore = useExtensionStore()
    extensionStore.registerExtension({
      name: 'pysssss.Locking',
      provenance: { createdBy: 'comfy-agent' }
    })

    renderPanel()

    await user.click(screen.getByRole('button', { name: 'More Options' }))
    expect(
      await screen.findByRole('menuitem', {
        name: 'Disable all agent-created'
      })
    ).toHaveAttribute('aria-disabled', 'true')
  })
})
