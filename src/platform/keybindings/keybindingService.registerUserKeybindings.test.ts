import { useSettingStore } from '@/platform/settings/settingStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'

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

  it('unsets a default binding registered before the user bindings load', () => {
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

  it('applies an unset to a binding registered after the user bindings load', () => {
    const combo = { key: 'd', ctrl: false, alt: false, shift: false }
    useSettingStore().settingValues['Comfy.Keybinding.UnsetBindings'] = [
      { commandId: 'LateExtension.Insert', combo }
    ]

    useKeybindingService().registerUserKeybindings()
    const keybindingStore = useKeybindingStore()
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({ commandId: 'LateExtension.Insert', combo })
    )

    expect(
      keybindingStore.getKeybindingByCommandId('LateExtension.Insert')
    ).toBeUndefined()
  })

  it('drops an unset whose key another default binding already holds', async () => {
    const settingStore = useSettingStore()
    vi.mocked(settingStore.setMany).mockResolvedValue(undefined)
    const combo = { key: 'b', ctrl: true, alt: false, shift: false }
    const keybindingStore = useKeybindingStore()
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'Comfy.Test.Bypass',
        combo,
        targetElementId: 'graph-canvas-container'
      })
    )
    settingStore.settingValues['Comfy.Keybinding.UnsetBindings'] = [
      { commandId: 'Comfy.Test.Bypass', combo, targetElementId: 'graph-canvas' }
    ]

    const keybindingService = useKeybindingService()
    keybindingService.registerUserKeybindings()
    await keybindingService.persistUserKeybindings()

    expect(
      keybindingStore.getKeybindingByCommandId('Comfy.Test.Bypass')
    ).toBeDefined()
    expect(keybindingStore.isCurrentPresetModified).toBe(false)
    expect(settingStore.setMany).toHaveBeenCalledWith(
      expect.objectContaining({ 'Comfy.Keybinding.UnsetBindings': [] })
    )
  })

  it('does not mark the default preset modified for an unset still waiting for its binding', () => {
    useSettingStore().settingValues['Comfy.Keybinding.UnsetBindings'] = [
      {
        commandId: 'UninstalledExtension.Run',
        combo: { key: 'g', ctrl: false, alt: true, shift: false }
      }
    ]

    useKeybindingService().registerUserKeybindings()

    expect(useKeybindingStore().isCurrentPresetModified).toBe(false)
  })

  it('forgets a waiting unset when all keybindings are reset', async () => {
    const settingStore = useSettingStore()
    vi.mocked(settingStore.setMany).mockResolvedValue(undefined)
    settingStore.settingValues['Comfy.Keybinding.UnsetBindings'] = [
      {
        commandId: 'DisabledExtension.Run',
        combo: { key: 'r', ctrl: true, alt: false, shift: false }
      }
    ]

    const keybindingService = useKeybindingService()
    keybindingService.registerUserKeybindings()
    useKeybindingStore().resetAllKeybindings()
    await keybindingService.persistUserKeybindings()

    expect(settingStore.setMany).toHaveBeenCalledWith(
      expect.objectContaining({ 'Comfy.Keybinding.UnsetBindings': [] })
    )
  })

  it('saves back an unset whose binding has not registered', async () => {
    const settingStore = useSettingStore()
    vi.mocked(settingStore.setMany).mockResolvedValue(undefined)
    const unset = {
      commandId: 'DisabledExtension.Run',
      combo: { key: 'r', ctrl: true, alt: false, shift: false }
    }
    settingStore.settingValues['Comfy.Keybinding.UnsetBindings'] = [unset]

    const keybindingService = useKeybindingService()
    keybindingService.registerUserKeybindings()
    await keybindingService.persistUserKeybindings()

    expect(settingStore.setMany).toHaveBeenCalledWith(
      expect.objectContaining({
        'Comfy.Keybinding.UnsetBindings': [
          expect.objectContaining({
            commandId: unset.commandId,
            combo: expect.objectContaining({ key: 'r', ctrl: true })
          })
        ]
      })
    )
  })
})
