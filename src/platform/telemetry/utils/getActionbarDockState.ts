import type { ActionbarDockState } from '@/platform/telemetry/types'

export function getActionbarDockState(): ActionbarDockState {
  return localStorage.getItem('Comfy.MenuPosition.Docked') === 'false'
    ? 'floating'
    : 'docked'
}
