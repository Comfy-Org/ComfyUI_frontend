import { useSettingStore } from '@/platform/settings/settingStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

describe('keybindingService - registerUserKeybindings', () => {
  beforeEach(() => {
    useSettingStore().settingValues['Comfy.Keybinding.NewBindings'] = []
    useSettingStore().settingValues['Comfy.Keybinding.UnsetBindings'] = []
  })

  it('does not warn when unset binding targets a command that no longer exists', () => {
    // A command removed from the app (e.g. ConvertSelectedNodesToGroupNode,
    // removed in #12931) can still linger in the persisted UnsetBindings.
    useSettingStore().settingValues['Comfy.Keybinding.UnsetBindings'] = [
      {
        commandId: 'ConvertSelectedNodesToGroupNode',
        combo: { key: 'g', ctrl: true, alt: false, shift: false }
      }
    ]

    useKeybindingService().registerUserKeybindings()

    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Trying to unset non-exist keybinding')
    )
  })

  it('still unsets bindings for commands that are registered', () => {
    const commandStore = useCommandStore()
    commandStore.registerCommand({
      id: 'Comfy.Test.Registered',
      function: vi.fn()
    })

    const keybindingStore = useKeybindingStore()
    const combo = { key: 'g', ctrl: true, alt: false, shift: false }
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({ commandId: 'Comfy.Test.Registered', combo })
    )

    useSettingStore().settingValues['Comfy.Keybinding.UnsetBindings'] = [
      { commandId: 'Comfy.Test.Registered', combo }
    ]

    useKeybindingService().registerUserKeybindings()

    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Trying to unset non-exist keybinding')
    )
    expect(
      keybindingStore.getKeybindingByCommandId('Comfy.Test.Registered')
    ).toBeUndefined()
  })
})
