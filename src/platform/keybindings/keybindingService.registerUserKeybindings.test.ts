import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

const settings = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  setMany: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn((key: string) => settings.values[key] ?? []),
    setMany: settings.setMany
  }))
}))

describe('keybindingService - registerUserKeybindings', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    settings.values = {}
    settings.setMany.mockReset()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('does not warn when unset binding targets a command that no longer exists', () => {
    // A command removed from the app (e.g. ConvertSelectedNodesToGroupNode,
    // removed in #12931) can still linger in the persisted UnsetBindings.
    settings.values['Comfy.Keybinding.UnsetBindings'] = [
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

    settings.values['Comfy.Keybinding.UnsetBindings'] = [
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
    settings.values['Comfy.Keybinding.UnsetBindings'] = [
      {
        commandId: 'Comfy.Test.MaskUndo',
        combo,
        dialogKey: 'global-mask-editor'
      }
    ]
    settings.values['Comfy.Keybinding.NewBindings'] = [
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

    await service.persistUserKeybindings()

    expect(settings.setMany).toHaveBeenCalledWith({
      'Comfy.Keybinding.NewBindings': [
        expect.objectContaining({
          commandId: 'Comfy.Test.MaskUndo',
          combo: expect.objectContaining({ key: 'u', ctrl: true }),
          dialogKey: 'global-mask-editor'
        })
      ],
      'Comfy.Keybinding.UnsetBindings': [
        expect.objectContaining({
          commandId: 'Comfy.Test.MaskUndo',
          combo: expect.objectContaining({ key: 'z', ctrl: true }),
          dialogKey: 'global-mask-editor'
        })
      ]
    })
  })
})
