import { describe, expect, it } from 'vitest'

import { KeyComboImpl } from '@/platform/keybindings/keyCombo'

import { CORE_KEYBINDINGS } from './defaults'

function findKeybinding(commandId: string) {
  return CORE_KEYBINDINGS.find((kb) => kb.commandId === commandId)
}

describe('CORE_KEYBINDINGS', () => {
  describe('sidebar toggle shortcuts use Ctrl+Shift modifier', () => {
    const sidebarCommands = [
      {
        commandId: 'Workspace.ToggleSidebarTab.workflows',
        expectedKey: 'w'
      },
      {
        commandId: 'Workspace.ToggleSidebarTab.node-library',
        expectedKey: 'n'
      },
      {
        commandId: 'Workspace.ToggleSidebarTab.model-library',
        expectedKey: 'm'
      },
      {
        commandId: 'Workspace.ToggleSidebarTab.assets',
        expectedKey: 'a'
      }
    ]

    it.each(sidebarCommands)(
      '$commandId is bound to Ctrl+Shift+$expectedKey',
      ({ commandId, expectedKey }) => {
        const kb = findKeybinding(commandId)
        expect(kb).toBeDefined()
        expect(kb!.combo).toEqual(
          expect.objectContaining({
            ctrl: true,
            shift: true,
            key: expectedKey
          })
        )
      }
    )

    it.each(sidebarCommands)(
      '$commandId is not reserved by text input',
      ({ commandId }) => {
        const kb = findKeybinding(commandId)
        const combo = new KeyComboImpl(kb!.combo)
        expect(combo.isReservedByTextInput).toBe(false)
      }
    )
  })

  it('Comfy.ToggleLinear is bound to Ctrl+Shift+D', () => {
    const kb = findKeybinding('Comfy.ToggleLinear')
    expect(kb).toBeDefined()
    expect(kb!.combo).toEqual(
      expect.objectContaining({
        ctrl: true,
        shift: true,
        key: 'd'
      })
    )
  })

  it('no keybinding uses Ctrl+Shift+A for ToggleLinear', () => {
    const toggleLinear = findKeybinding('Comfy.ToggleLinear')
    expect(toggleLinear!.combo.key).not.toBe('a')
  })
})
