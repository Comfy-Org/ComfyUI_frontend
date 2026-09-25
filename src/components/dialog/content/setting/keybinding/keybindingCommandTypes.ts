import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import type { ComfyCommandImpl } from '@/stores/commandStore'

export type KeybindingCommand = Pick<ComfyCommandImpl, 'id' | 'source'> & {
  keybindings: KeybindingImpl[]
  label: string
  isModified: boolean
}
