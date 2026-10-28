import type { ActionbarDockState } from '@comfyorg/telemetry-contract/types'

export function getActionbarDockState(): ActionbarDockState {
  try {
    return localStorage.getItem('Comfy.MenuPosition.Docked') === 'false'
      ? 'floating'
      : 'docked'
  } catch {
    return 'docked'
  }
}
