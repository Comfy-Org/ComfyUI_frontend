import type { ActionbarDockState } from '@comfyorg/telemetry/types'
import { safeLocalStorage } from '@/base/storage/safeStorage'

export function getActionbarDockState(): ActionbarDockState {
  return safeLocalStorage.getItem('Comfy.MenuPosition.Docked') === 'false'
    ? 'floating'
    : 'docked'
}
