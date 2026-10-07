import { onTestFinished, vi } from 'vitest'

import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'

/** Installs the app's capture-phase shortcut dispatcher for the current test. */
export function installKeybindingDispatcher() {
  useSettingStore().settingValues['Comfy.Keybinding.CapturePhase'] = true
  onTestFinished(useKeybindingService().install())
}

/** Binds Ctrl+S, which text inputs do not reserve, and returns its command. */
export function bindUnreservedShortcut() {
  const run = vi.fn()
  useCommandStore().registerCommand({ id: 'Test.Unreserved', function: run })
  useKeybindingStore().addDefaultKeybinding(
    new KeybindingImpl({
      commandId: 'Test.Unreserved',
      combo: { key: 's', ctrl: true }
    })
  )
  return run
}
