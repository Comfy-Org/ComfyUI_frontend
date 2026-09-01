import type { ActionbarDockState } from '@/platform/telemetry/types'

export function getActionbarDockState(): ActionbarDockState {
  try {
    return localStorage.getItem('Comfy.MenuPosition.Docked') === 'false'
      ? 'floating'
      : 'docked'
  } catch {
    return 'docked'
  }
}
