import { zKeybinding } from '@/platform/keybindings/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

describe('keybindingService - registerUserKeybindings', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    useSettingStore().settingValues['Comfy.Keybinding.SettingsV1'] = null
    useSettingStore().settingValues['Comfy.Keybinding.CurrentPreset'] =
      'default'
    useSettingStore().settingValues['Comfy.Keybinding.NewBindings'] = []
    useSettingStore().settingValues['Comfy.Keybinding.UnsetBindings'] = []
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
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

    expect(warnSpy).not.toHaveBeenCalledWith(
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

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Trying to unset non-exist keybinding')
    )
    expect(
      keybindingStore.getKeybindingByCommandId('Comfy.Test.Registered')
    ).toBeUndefined()
  })

  it('round-trips dialog-scoped bindings through the persisted settings', async () => {
    const commandStore = useCommandStore()
    commandStore.registerCommands([
      { id: 'Comfy.Test.Undo', function: vi.fn() },
      { id: 'Comfy.Test.MaskUndo', function: vi.fn() }
    ])
    const combo = { key: 'z', ctrl: true, alt: false, shift: false }
    const keybindingStore = useKeybindingStore()
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({ commandId: 'Comfy.Test.Undo', combo })
    )
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'Comfy.Test.MaskUndo',
        combo,
        dialogKey: 'global-mask-editor'
      })
    )
    useSettingStore().settingValues['Comfy.Keybinding.UnsetBindings'] = [
      {
        commandId: 'Comfy.Test.MaskUndo',
        combo,
        dialogKey: 'global-mask-editor'
      }
    ]
    useSettingStore().settingValues['Comfy.Keybinding.NewBindings'] = [
      {
        commandId: 'Comfy.Test.MaskUndo',
        combo: { key: 'u', ctrl: true },
        dialogKey: 'global-mask-editor'
      }
    ]

    const service = useKeybindingService()
    service.registerUserKeybindings()

    const ctrlZ = new KeyComboImpl(combo)
    expect(keybindingStore.getKeybindings(ctrlZ)[0]?.commandId).toBe(
      'Comfy.Test.Undo'
    )
    expect(keybindingStore.getKeybindings(ctrlZ, 'global-mask-editor')).toEqual(
      []
    )
    expect(
      keybindingStore.getKeybindings(
        new KeyComboImpl({ key: 'u', ctrl: true }),
        'global-mask-editor'
      )[0]?.commandId
    ).toBe('Comfy.Test.MaskUndo')

    const setMany = vi.spyOn(useSettingStore(), 'setMany').mockResolvedValue()
    await service.persistUserKeybindings()

    expect(setMany).toHaveBeenCalledWith({
      'Comfy.Keybinding.NewBindings': [],
      'Comfy.Keybinding.UnsetBindings': [],
      'Comfy.Keybinding.SettingsV1': {
        version: 1,
        currentPreset: 'default',
        newBindings: [
          expect.objectContaining({
            commandId: 'Comfy.Test.MaskUndo',
            combo: expect.objectContaining({ key: 'u', ctrl: true }),
            dialogKey: 'global-mask-editor'
          })
        ],
        unsetBindings: [
          expect.objectContaining({
            commandId: 'Comfy.Test.MaskUndo',
            combo: expect.objectContaining({ key: 'z', ctrl: true }),
            dialogKey: 'global-mask-editor'
          })
        ]
      }
    })
  })

  it('restores hold behavior from versioned settings after an older frontend edits the mirror', async () => {
    const settings = useSettingStore()
    const bindings = useKeybindingStore()
    const service = useKeybindingService()
    const original = new KeybindingImpl({
      commandId: 'test.pan',
      combo: { key: ' ' },
      when: 'test.pan.active',
      releaseCommandId: 'test.pan.Release',
      allowRepeat: false
    })
    bindings.addDefaultKeybinding(original)
    const rebound = new KeybindingImpl({
      ...zKeybinding.parse(original),
      combo: { key: 'p' }
    })
    bindings.updateSpecificKeybinding(original, rebound)
    vi.spyOn(settings, 'setMany').mockImplementation(async (values) => {
      Object.assign(settings.settingValues, JSON.parse(JSON.stringify(values)))
    })
    await service.persistUserKeybindings()
    settings.settingValues['Comfy.Keybinding.NewBindings'] = []
    settings.settingValues['Comfy.Keybinding.UnsetBindings'] = []
    bindings.resetAllKeybindings()

    service.registerUserKeybindings()

    expect(bindings.getKeybindingByCommandId('test.pan')?.equals(rebound)).toBe(
      true
    )
    expect(bindings.getKeybindings(original.combo)).toEqual([])
  })

  it('keeps an unset binding until its component registers later', () => {
    const binding = new KeybindingImpl({
      commandId: 'test.late',
      combo: { key: 'Escape' },
      when: 'test.late.active'
    })
    useSettingStore().settingValues['Comfy.Keybinding.UnsetBindings'] = [
      binding
    ]
    const bindings = useKeybindingStore()
    useKeybindingService().registerUserKeybindings()

    bindings.addDefaultKeybinding(binding)

    expect(bindings.getKeybindingByCommandId('test.late')).toBeUndefined()
    expect(bindings.getUserUnsetKeybindings()[0].equals(binding)).toBe(true)
  })
})
