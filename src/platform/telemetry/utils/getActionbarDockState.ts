import type { ActionbarDockState } from '@comfyorg/telemetry/types'
import { safeLocalStorage } from '@comfyorg/shared-frontend-utils/safeStorage'

export function getActionbarDockState(): ActionbarDockState {
  return safeLocalStorage.getItem('Comfy.MenuPosition.Docked') === 'false'
    ? 'floating'
    : 'docked'
}
