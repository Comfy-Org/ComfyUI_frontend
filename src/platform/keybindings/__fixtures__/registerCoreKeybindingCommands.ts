import { CORE_KEYBINDINGS } from '@/platform/keybindings/defaults'
import { useCommandStore } from '@/platform/keybindings/commandStore'

export function registerCoreKeybindingCommands() {
  const commandStore = useCommandStore()
  for (const id of new Set(CORE_KEYBINDINGS.map((k) => k.commandId))) {
    commandStore.registerCommand({ id, function: () => {} })
  }
}
