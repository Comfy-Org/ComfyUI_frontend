import type { ActionbarDockState } from '@/platform/telemetry/types'

export function getActionbarDockState(): ActionbarDockState {
  const dockState = localStorage.getItem('Comfy.MenuPosition.DockState')
  if (dockState === 'top' || dockState === 'bottom') {
    return 'docked'
  }
  if (dockState === 'floating') {
    return 'floating'
  }
  return localStorage.getItem('Comfy.MenuPosition.Docked') === 'false'
    ? 'floating'
    : 'docked'
}
