import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { testI18n } from '@/utils/__tests__/testI18n'
import { useToast } from '@/components/ui/toast/toastStore'
import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
import { showSettingsPanel } from '@/platform/settings/composables/useSettingsDialog'

import ExtensionPanel from './ExtensionPanel.vue'

const DISABLED_PACKS = 'Comfy.Extension.DisabledPacks'
const PACK_SETTING = CORE_SETTINGS.find(
  (setting) => setting.id === DISABLED_PACKS
)!

function registerExtensions(...names: string[]) {
  const extensionStore = useExtensionStore()
  for (const name of names) extensionStore.registerExtension({ name })
}

function registerDisabledSetting() {
  useSettingStore().addSetting(
    CORE_SETTINGS.find((setting) => setting.id === 'Comfy.Extension.Disabled')!
  )
}

function renderPanel() {
  return render(ExtensionPanel, { global: { plugins: [testI18n] } })
}

function bootWithPacks(packs: string[], saved: unknown) {
  const settingStore = useSettingStore()
  Object.assign(settingStore.settingValues, { [DISABLED_PACKS]: saved })
  settingStore.addSetting(PACK_SETTING)
  useExtensionStore().loadExtensionPackPaths(
    packs,
    settingStore.get(DISABLED_PACKS)
  )
  return settingStore
}

const packSwitch = (name: string) =>
  screen.getByRole('switch', { name: `Extension pack ${name}` })

const reloadButton = () =>
  screen.queryByRole('button', { name: 'Reload to apply changes' })

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
    registerDisabledSetting()
    const storeSetting = vi
      .spyOn(api, 'storeSetting')
      .mockResolvedValue(new Response())
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
    await vi.waitFor(() =>
      expect(storeSetting).toHaveBeenLastCalledWith(
        'Comfy.Extension.Disabled',
        ['Zebra']
      )
    )

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
    registerDisabledSetting()
    const storeSetting = vi
      .spyOn(api, 'storeSetting')
      .mockResolvedValue(new Response())
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

    renderPanel()
    const moreOptions = screen.getByRole('button', { name: 'More Options' })
    expect(moreOptions).toHaveAttribute('aria-haspopup', 'menu')
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }))
    await user.click(moreOptions)
    await user.click(
      await screen.findByRole('menuitem', { name: 'Disable Selected' })
    )

    await vi.waitFor(() =>
      expect(storeSetting).toHaveBeenLastCalledWith(
        'Comfy.Extension.Disabled',
        ['Alpha']
      )
    )
    expect(screen.getByRole('switch', { name: 'Alpha' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Zebra' })).toBeChecked()
    await user.click(
      screen.getByRole('button', { name: 'Reload to apply changes' })
    )
    expect(reload).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'More Options' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Enable Selected' })
    )

    await vi.waitFor(() =>
      expect(storeSetting).toHaveBeenLastCalledWith(
        'Comfy.Extension.Disabled',
        []
      )
    )
    expect(screen.getByRole('switch', { name: 'Alpha' })).toBeChecked()
    expect(
      screen.queryByRole('button', { name: 'Reload to apply changes' })
    ).not.toBeInTheDocument()
  })

  describe('extension packs', () => {
    it('keeps disabled packs across panel remounts and later edits', async () => {
      const user = userEvent.setup()
      const settingStore = bootWithPacks(
        ['/extensions/agent-cushions/', '/extensions/other/'],
        ['/extensions/missing/']
      )
      vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())

      const panel = renderPanel()
      await user.click(packSwitch('agent-cushions'))
      await vi.waitFor(() =>
        expect(settingStore.get(DISABLED_PACKS)).toEqual([
          '/extensions/missing/',
          '/extensions/agent-cushions/'
        ])
      )
      panel.unmount()
      renderPanel()

      expect(packSwitch('agent-cushions')).not.toBeChecked()
      expect(screen.getByRole('alert')).toHaveTextContent('[-] agent-cushions')

      await user.click(packSwitch('other'))
      await vi.waitFor(() =>
        expect(settingStore.get(DISABLED_PACKS)).toEqual([
          '/extensions/missing/',
          '/extensions/agent-cushions/',
          '/extensions/other/'
        ])
      )
    })

    it('holds the reload and every pack switch until the save is acknowledged', async () => {
      const user = userEvent.setup()
      bootWithPacks(['/extensions/agent-cushions/', '/extensions/other/'], [])
      let acknowledge = () => {}
      let requested = false
      vi.spyOn(api, 'storeSetting').mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            requested = true
            acknowledge = () => resolve(new Response())
          })
      )
      const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

      renderPanel()
      await user.click(packSwitch('agent-cushions'))
      await vi.waitFor(() => expect(requested).toBe(true))

      expect(reloadButton()).toBeDisabled()
      expect(packSwitch('other')).toBeDisabled()

      acknowledge()
      await vi.waitFor(() => expect(reloadButton()).toBeEnabled())

      expect(packSwitch('other')).toBeEnabled()
      await user.click(reloadButton()!)
      expect(reload).toHaveBeenCalledOnce()
    })

    it('returns the switch to the stored value and says so when the save fails', async () => {
      const user = userEvent.setup()
      const settingStore = bootWithPacks(['/extensions/agent-cushions/'], [])
      vi.spyOn(api, 'storeSetting').mockResolvedValue(
        new Response(null, { status: 500, statusText: 'Server Error' })
      )

      const panel = renderPanel()
      await user.click(packSwitch('agent-cushions'))
      await vi.waitFor(() =>
        expect(useToast().toasts).toContainEqual(
          expect.objectContaining({
            kind: 'warning',
            title: expect.stringContaining('500 Server Error')
          })
        )
      )

      expect(packSwitch('agent-cushions')).toBeChecked()
      expect(settingStore.get(DISABLED_PACKS)).toEqual([])
      expect(reloadButton()).not.toBeInTheDocument()

      panel.unmount()
      renderPanel()

      expect(packSwitch('agent-cushions')).toBeChecked()
      expect(reloadButton()).not.toBeInTheDocument()
    })

    it('opens with a corrupt saved pack list instead of throwing', () => {
      const settingStore = bootWithPacks(['/extensions/agent-cushions/'], {})

      renderPanel()

      expect(settingStore.get(DISABLED_PACKS)).toEqual([])
      expect(packSwitch('agent-cushions')).toBeChecked()
      expect(reloadButton()).not.toBeInTheDocument()
    })

    it('shows a decoded pack name in both the table and the pending banner', async () => {
      const user = userEvent.setup()
      bootWithPacks(['/extensions/with%20space/'], [])
      vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())

      renderPanel()
      expect(screen.getByRole('cell', { name: 'with space' })).toBeVisible()

      await user.click(packSwitch('with space'))
      await vi.waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('[-] with space')
      )
    })
  })

  it('filters, describes, and disables agent-created extensions', async () => {
    const user = userEvent.setup()
    const settingStore = bootWithPacks(['/extensions/cushions/'], [])
    settingStore.addSetting(
      CORE_SETTINGS.find(
        (setting) => setting.id === 'Comfy.Extension.Disabled'
      )!
    )
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
    const storeSettings = vi
      .spyOn(api, 'storeSettings')
      .mockResolvedValue(new Response())

    renderPanel()
    expect(screen.getAllByText('Created by agent')).toHaveLength(2)
    expect(screen.getByText(/Adds cushion controls/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Agent-created' }))
    expect(
      screen.getByRole('switch', { name: 'agent.cushions.toolbar' })
    ).toBeVisible()
    expect(
      screen.queryByRole('switch', { name: 'Manual.Toolbar' })
    ).not.toBeInTheDocument()

    await user.type(screen.getByRole('combobox'), 'cushions')
    await user.click(screen.getByRole('button', { name: 'More Options' }))
    await user.click(
      await screen.findByRole('menuitem', {
        name: 'Disable all agent-created'
      })
    )

    expect(storeSettings).toHaveBeenCalledExactlyOnceWith({
      'Comfy.Extension.Disabled': ['agent-made.standalone'],
      'Comfy.Extension.DisabledPacks': ['/extensions/cushions/']
    })
    await user.clear(screen.getByRole('combobox'))
    await user.click(screen.getByRole('button', { name: 'All' }))
    await vi.waitFor(() =>
      expect(
        screen.getByRole('switch', { name: 'agent-made.standalone' })
      ).not.toBeChecked()
    )
    expect(screen.getByRole('switch', { name: 'Manual.Toolbar' })).toBeChecked()
    expect(
      screen.getByRole('switch', { name: 'agentic.toolbar' })
    ).toBeChecked()
    expect(
      screen.getByRole('switch', { name: 'agent.cushions.toolbar' })
    ).toBeChecked()
    expect(packSwitch('cushions')).not.toBeChecked()
    expect(reloadButton()).toBeVisible()
  })

  it('leaves every control enabled when the bulk disable is refused', async () => {
    const user = userEvent.setup()
    const settingStore = bootWithPacks(['/extensions/cushions/'], [])
    settingStore.addSetting(
      CORE_SETTINGS.find(
        (setting) => setting.id === 'Comfy.Extension.Disabled'
      )!
    )
    registerExtensions('agent.cushions.toolbar')
    vi.spyOn(api, 'storeSettings').mockResolvedValue(
      new Response(null, { status: 500, statusText: 'Server Error' })
    )

    renderPanel()
    await user.click(screen.getByRole('button', { name: 'More Options' }))
    await user.click(
      await screen.findByRole('menuitem', {
        name: 'Disable all agent-created'
      })
    )

    await vi.waitFor(() =>
      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'warning' })
      ])
    )
    expect(settingStore.get(DISABLED_PACKS)).toEqual([])
    expect(packSwitch('cushions')).toBeChecked()
    expect(reloadButton()).not.toBeInTheDocument()
  })

  it.for([
    {
      name: 'before mount',
      arrange: () => {
        showSettingsPanel('extension', { extensionFilter: 'agentCreated' })
        renderPanel()
      }
    },
    {
      name: 'after mount',
      arrange: () => {
        renderPanel()
        showSettingsPanel('extension', { extensionFilter: 'agentCreated' })
      }
    }
  ])('applies an agent filter request $name', async ({ arrange }) => {
    registerExtensions('Manual.Toolbar', 'agent.cushions.toolbar')
    arrange()

    expect(
      await screen.findByRole('switch', { name: 'agent.cushions.toolbar' })
    ).toBeVisible()
    expect(
      screen.queryByRole('switch', { name: 'Manual.Toolbar' })
    ).not.toBeInTheDocument()
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
})
