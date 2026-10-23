import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { testI18n } from '@/utils/__tests__/testI18n'
import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
import { requestAgentExtensionFilter } from '@/platform/settings/agentExtensionService'

import ExtensionPanel from './ExtensionPanel.vue'

const DISABLED_PACKS = 'Comfy.Extension.DisabledPacks'
const PACK_SETTING = CORE_SETTINGS.find(
  (setting) => setting.id === DISABLED_PACKS
)!

function registerExtensions(...names: string[]) {
  const extensionStore = useExtensionStore()
  for (const name of names) extensionStore.registerExtension({ name })
}

function renderPanel() {
  return render(ExtensionPanel, { global: { plugins: [testI18n] } })
}

/**
 * Brings up the panel's dependencies the way boot does: the saved value is in
 * place before the setting registers, so its normalization runs, and the
 * extension store takes its snapshot from that same value. Tests drive the
 * save through `api.storeSetting` rather than stubbing `settingStore.set`,
 * because every behaviour here is about the ordering and failure handling
 * between the panel and the setting that owns the value.
 */
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

/** See the note on the same helper in `extensionStore.test.ts`. */
async function flushMicrotasks() {
  for (let hop = 0; hop < 50; hop++) await Promise.resolve()
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

  describe('extension packs', () => {
    it('disables a whole extension pack without dropping absent disabled packs', async () => {
      const user = userEvent.setup()
      const settingStore = bootWithPacks(
        ['/extensions/agent-cushions/'],
        ['/extensions/missing/']
      )
      vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())

      renderPanel()
      await user.click(packSwitch('agent-cushions'))
      await flushMicrotasks()

      expect(api.storeSetting).toHaveBeenLastCalledWith(DISABLED_PACKS, [
        '/extensions/missing/',
        '/extensions/agent-cushions/'
      ])
      expect(settingStore.get(DISABLED_PACKS)).toEqual([
        '/extensions/missing/',
        '/extensions/agent-cushions/'
      ])
      expect(reloadButton()).toBeVisible()
      expect(screen.getByRole('alert')).toHaveTextContent('[-] agent-cushions')
    })

    it('keeps disabled packs across panel remounts and later edits', async () => {
      const user = userEvent.setup()
      const settingStore = bootWithPacks(
        ['/extensions/agent-cushions/', '/extensions/other/'],
        ['/extensions/missing/']
      )
      vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())

      const panel = renderPanel()
      await user.click(packSwitch('agent-cushions'))
      await flushMicrotasks()
      panel.unmount()
      renderPanel()

      expect(packSwitch('agent-cushions')).not.toBeChecked()
      expect(screen.getByRole('alert')).toHaveTextContent('[-] agent-cushions')

      await user.click(packSwitch('other'))
      await flushMicrotasks()

      expect(settingStore.get(DISABLED_PACKS)).toEqual([
        '/extensions/missing/',
        '/extensions/agent-cushions/',
        '/extensions/other/'
      ])
    })

    it('keeps the reload unavailable until the save is acknowledged', async () => {
      const user = userEvent.setup()
      bootWithPacks(['/extensions/agent-cushions/'], [])
      let acknowledge = () => {}
      vi.spyOn(api, 'storeSetting').mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            acknowledge = () => resolve(new Response())
          })
      )
      const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

      renderPanel()
      await user.click(packSwitch('agent-cushions'))
      await flushMicrotasks()

      // Reloading now would re-read the list the server still holds and lose
      // the change the switch already shows.
      expect(reloadButton()).toBeDisabled()

      acknowledge()
      await flushMicrotasks()

      expect(reloadButton()).toBeEnabled()
      await user.click(reloadButton()!)
      expect(reload).toHaveBeenCalledOnce()
    })

    it.for([
      {
        label: 'refuses the write',
        storeSetting: () =>
          Promise.resolve(
            new Response(null, { status: 500, statusText: 'Server Error' })
          )
      },
      {
        label: 'is unreachable',
        storeSetting: () => Promise.reject(new Error('offline'))
      }
    ])(
      'returns the switch to the stored value when the server $label',
      async ({ storeSetting }) => {
        const user = userEvent.setup()
        const settingStore = bootWithPacks(['/extensions/agent-cushions/'], [])
        vi.spyOn(api, 'storeSetting').mockImplementation(storeSetting)

        const panel = renderPanel()
        await user.click(packSwitch('agent-cushions'))
        await flushMicrotasks()

        expect(packSwitch('agent-cushions')).toBeChecked()
        expect(settingStore.get(DISABLED_PACKS)).toEqual([])
        expect(reloadButton()).not.toBeInTheDocument()

        // The failed disable must not come back when the panel is reopened,
        // which is what a panel-local rollback could not guarantee.
        panel.unmount()
        renderPanel()

        expect(packSwitch('agent-cushions')).toBeChecked()
        expect(reloadButton()).not.toBeInTheDocument()
      }
    )

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
      await flushMicrotasks()

      expect(screen.getByRole('alert')).toHaveTextContent('[-] with space')
    })
  })

  it('filters, describes, and disables agent-created extensions', async () => {
    const user = userEvent.setup()
    const extensionStore = useExtensionStore()
    extensionStore.registerExtension({ name: 'Manual.Toolbar' })
    extensionStore.registerExtension({
      name: 'agent.cushions.toolbar',
      provenance: {
        createdBy: 'comfy-agent',
        summary: 'Adds cushion controls'
      }
    })
    extensionStore.loadExtensionPackPaths(['/extensions/cushions/'], [])
    const setSettings = vi
      .spyOn(useSettingStore(), 'setMany')
      .mockResolvedValue()

    renderPanel()
    expect(screen.getByText('Created by agent')).toBeVisible()
    expect(screen.getByText(/Adds cushion controls/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Agent-created' }))
    expect(
      screen.getByRole('switch', { name: 'agent.cushions.toolbar' })
    ).toBeVisible()
    expect(
      screen.queryByRole('switch', { name: 'Manual.Toolbar' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'More Options' }))
    await user.click(
      await screen.findByRole('menuitem', {
        name: 'Disable all agent-created'
      })
    )
    expect(setSettings).toHaveBeenCalledExactlyOnceWith({
      'Comfy.Extension.Disabled': [],
      'Comfy.Extension.DisabledPacks': ['/extensions/cushions/']
    })
    expect(
      screen.getByRole('switch', { name: 'agent.cushions.toolbar' })
    ).toBeChecked()
  })

  it('applies an agent filter request while the panel is already open', async () => {
    registerExtensions('Manual.Toolbar', 'agent.cushions.toolbar')
    renderPanel()

    requestAgentExtensionFilter('agentCreated')

    expect(
      await screen.findByRole('switch', { name: 'agent.cushions.toolbar' })
    ).toBeVisible()
    expect(
      screen.queryByRole('switch', { name: 'Manual.Toolbar' })
    ).not.toBeInTheDocument()
  })
})
