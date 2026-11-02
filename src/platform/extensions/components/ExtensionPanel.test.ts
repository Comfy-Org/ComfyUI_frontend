import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { testI18n } from '@/utils/__tests__/testI18n'
import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'

import ExtensionPanel from './ExtensionPanel.vue'

vi.mock(import('@comfyorg/telemetry/reportError'))

function registerExtensions(...names: string[]) {
  const extensionStore = useExtensionStore()
  for (const name of names) extensionStore.registerExtension({ name })
}

function renderPanel() {
  return render(ExtensionPanel, { global: { plugins: [testI18n] } })
}

function loadExtensionPaths(paths: string[], disabledAtBoot: string[]) {
  useSettingStore().$patch({
    settingValues: {
      'Comfy.Extension.DisabledPacks': disabledAtBoot
    }
  })
  useExtensionStore().loadExtensionPaths(paths, disabledAtBoot)
}

function pendingChangeFor(subject: string) {
  const row = screen
    .getAllByRole('listitem')
    .find((item) => item.textContent.includes(subject))
  return row?.textContent ?? ''
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
    vi.spyOn(useSettingStore(), 'set').mockResolvedValue(undefined)
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
    const setSetting = vi
      .spyOn(useSettingStore(), 'set')
      .mockResolvedValue(undefined)
    renderPanel()
    const search = screen.getByRole('combobox', {
      name: 'Search Extensions...'
    })
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
    const setSetting = vi
      .spyOn(useSettingStore(), 'set')
      .mockResolvedValue(undefined)
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

  it('disables a whole extension folder without dropping absent disabled paths', async () => {
    const user = userEvent.setup()
    loadExtensionPaths(
      ['/extensions/agent-cushions/'],
      ['/extensions/missing/']
    )
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())

    renderPanel()
    await user.click(
      screen.getByRole('switch', { name: 'Extension folder agent-cushions' })
    )

    expect(useSettingStore().get('Comfy.Extension.DisabledPacks')).toEqual([
      '/extensions/missing/',
      '/extensions/agent-cushions/'
    ])
    expect(
      screen.getByRole('button', { name: 'Reload to apply changes' })
    ).toBeVisible()
    expect(pendingChangeFor('agent-cushions')).toContain('[-]')
  })

  it('marks a pending extension enable with [+]', async () => {
    const user = userEvent.setup()
    loadExtensionPaths(
      ['/extensions/agent-cushions/'],
      ['/extensions/agent-cushions/', '/extensions/missing/']
    )
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())

    renderPanel()
    await user.click(
      screen.getByRole('switch', { name: 'Extension folder agent-cushions' })
    )

    expect(useSettingStore().get('Comfy.Extension.DisabledPacks')).toEqual([
      '/extensions/missing/'
    ])
    expect(pendingChangeFor('agent-cushions')).toContain('[+]')
  })

  it('keeps pending extension state across panel remounts', async () => {
    const user = userEvent.setup()
    loadExtensionPaths(['/extensions/agent-cushions/'], [])
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())

    const firstPanel = renderPanel()
    await user.click(
      screen.getByRole('switch', { name: 'Extension folder agent-cushions' })
    )
    firstPanel.unmount()
    renderPanel()

    expect(
      screen.getByRole('switch', { name: 'Extension folder agent-cushions' })
    ).not.toBeChecked()
    expect(pendingChangeFor('agent-cushions')).toContain('[-]')
  })

  it('keeps extension controls unavailable until the setting persists', async () => {
    const user = userEvent.setup()
    let resolveSetting = (_response: Response) => {}
    const pendingSetting = new Promise<Response>((resolve) => {
      resolveSetting = resolve
    })
    loadExtensionPaths(['/extensions/a/'], [])
    vi.spyOn(api, 'storeSetting').mockReturnValue(pendingSetting)

    renderPanel()
    const extensionSwitch = screen.getByRole('switch', {
      name: 'Extension folder a'
    })
    await user.click(extensionSwitch)

    expect(extensionSwitch).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Reload to apply changes' })
    ).toBeDisabled()

    resolveSetting(new Response())
    await vi.waitFor(() => expect(extensionSwitch).toBeEnabled())
  })

  it('restores a refused extension change and warns without offering reload', async () => {
    const user = userEvent.setup()
    loadExtensionPaths(['/extensions/a/'], [])
    vi.spyOn(api, 'storeSetting').mockResolvedValue(
      new Response(null, { status: 400 })
    )

    renderPanel()
    const extensionSwitch = screen.getByRole('switch', {
      name: 'Extension folder a'
    })
    await user.click(extensionSwitch)

    await vi.waitFor(() => expect(extensionSwitch).toBeChecked())
    expect(
      screen.queryByRole('button', { name: 'Reload to apply changes' })
    ).not.toBeInTheDocument()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'failure_saving_extension_path_setting',
      surface: 'platform'
    })
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'Warning',
        description: 'The extension change was not saved. Please try again.'
      })
    )
  })

  it('keeps an indeterminate extension change and offers reload', async () => {
    const user = userEvent.setup()
    loadExtensionPaths(['/extensions/a/'], [])
    vi.spyOn(api, 'storeSetting').mockResolvedValue(
      new Response(null, { status: 500 })
    )

    renderPanel()
    const extensionSwitch = screen.getByRole('switch', {
      name: 'Extension folder a'
    })
    await user.click(extensionSwitch)

    await vi.waitFor(() => expect(extensionSwitch).not.toBeChecked())
    expect(
      screen.getByRole('button', { name: 'Reload to apply changes' })
    ).toBeEnabled()
    expect(useSettingStore().get('Comfy.Extension.DisabledPacks')).toEqual([
      '/extensions/a/'
    ])
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        description:
          'The extension change could not be confirmed. Reload the page before trying again.'
      })
    )
  })

  it('keeps an unconfirmed extension change visible across panel replacement', async () => {
    const user = userEvent.setup()
    const failure = new Error('setting unavailable')
    let rejectSetting = (_error: Error) => {}
    const pendingSetting = new Promise<Response>((_resolve, reject) => {
      rejectSetting = reject
    })
    vi.spyOn(api, 'storeSetting').mockReturnValue(pendingSetting)
    loadExtensionPaths(['/extensions/a/'], [])

    const firstPanel = renderPanel()
    await user.click(screen.getByRole('switch', { name: 'Extension folder a' }))
    firstPanel.unmount()
    renderPanel()

    const replacementSwitch = screen.getByRole('switch', {
      name: 'Extension folder a'
    })
    expect(replacementSwitch).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Reload to apply changes' })
    ).toBeDisabled()

    rejectSetting(failure)
    await vi.waitFor(() => expect(replacementSwitch).toBeEnabled())
    expect(replacementSwitch).not.toBeChecked()
    expect(useSettingStore().get('Comfy.Extension.DisabledPacks')).toEqual([
      '/extensions/a/'
    ])
    expect(pendingChangeFor('a')).toContain('[-]')
    expect(reportError).toHaveBeenCalledWith(failure, {
      errorType: 'failure_saving_extension_path_setting',
      surface: 'platform'
    })
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'Warning',
        description:
          'The extension change could not be confirmed. Reload the page before trying again.'
      })
    )
  })

  it('decodes extension names for display and accessibility', async () => {
    const user = userEvent.setup()
    loadExtensionPaths(['/extensions/My%20Pack/'], [])
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())

    renderPanel()
    await user.click(
      screen.getByRole('switch', { name: 'Extension folder My Pack' })
    )

    expect(pendingChangeFor('My Pack')).toContain('[-]')
  })

  it('reloads the current URL to apply extension changes', async () => {
    const user = userEvent.setup()
    loadExtensionPaths(['/extensions/a/'], [])
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()
    const historyState = { back: '/workflows' }
    window.history.replaceState(
      historyState,
      '',
      '/workflows?other=kept#selected'
    )

    renderPanel()
    await user.click(screen.getByRole('switch', { name: 'Extension folder a' }))
    await user.click(
      screen.getByRole('button', { name: 'Reload to apply changes' })
    )

    expect(
      window.location.pathname + window.location.search + window.location.hash
    ).toBe('/workflows?other=kept#selected')
    expect(window.history.state).toEqual(historyState)
    expect(reload).toHaveBeenCalledOnce()
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

  it.for([
    { disabled: false, checked: true },
    { disabled: true, checked: false }
  ])(
    'seeds a late extension switch when disabled is $disabled',
    async ({ disabled, checked }) => {
      const extensionStore = useExtensionStore()
      if (disabled) extensionStore.loadDisabledExtensionNames(['Late.Toolbar'])
      renderPanel()

      extensionStore.registerExtension({ name: 'Late.Toolbar' })

      expect(
        await screen.findByRole('switch', { name: 'Late.Toolbar' })
      ).toHaveAttribute('aria-checked', String(checked))
    }
  )
})
