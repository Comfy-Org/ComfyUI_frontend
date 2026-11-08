import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearEscapeOverrides,
  registerEscapeOverride
} from '@/platform/keybindings/escapeOverride'
import {
  clearKeybindingGates,
  registerKeybindingGate
} from '@/platform/keybindings/keybindingGate'
import { registerCoreKeybindingCommands } from '@/platform/keybindings/__fixtures__/registerCoreKeybindingCommands'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    canvas: null
  }
}))

function keydown(
  key: string,
  options: { ctrlKey?: boolean } = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrlKey ?? false,
    bubbles: true,
    cancelable: true
  })
  event.preventDefault = vi.fn()
  event.composedPath = vi.fn(() => [document.body])
  return event
}

describe('keybindingService - keybinding gate', () => {
  let keybindingService: ReturnType<typeof useKeybindingService>

  beforeEach(() => {
    vi.mocked(useSettingStore().get).mockImplementation(() => [])
    vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
    useDialogStore().dialogStack.length = 0
    registerCoreKeybindingCommands()
    keybindingService = useKeybindingService()
    keybindingService.registerCoreKeybindings()
  })

  afterEach(() => {
    clearKeybindingGates()
    clearEscapeOverrides()
  })

  it('runs a shortcut when no gate refuses it', async () => {
    const event = keydown(',', { ctrlKey: true })

    await keybindingService.keybindHandler(event)

    expect(useCommandStore().execute).toHaveBeenCalledWith(
      'Comfy.ShowSettingsDialog'
    )
  })

  it('leaves a refused shortcut alone, without swallowing the key', async () => {
    registerKeybindingGate(
      (commandId) => commandId === 'Comfy.ShowSettingsDialog'
    )
    const event = keydown('Escape')

    await keybindingService.keybindHandler(event)

    expect(useCommandStore().execute).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('still runs the shortcuts the gate lets through', async () => {
    registerKeybindingGate(
      (commandId) => commandId === 'Comfy.ShowSettingsDialog'
    )

    await keybindingService.keybindHandler(keydown(',', { ctrlKey: true }))

    expect(useCommandStore().execute).toHaveBeenCalledWith(
      'Comfy.ShowSettingsDialog'
    )
  })

  it('lets an Escape override act before the gate refuses the default', async () => {
    const override = vi.fn(() => true)
    registerEscapeOverride(override)
    registerKeybindingGate(() => false)
    const event = keydown('Escape')

    await keybindingService.keybindHandler(event)

    expect(override).toHaveBeenCalledOnce()
    expect(useCommandStore().execute).not.toHaveBeenCalled()
  })
})
