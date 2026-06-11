import { ACTIONBAR_DOCKED_STORAGE_KEY } from '@/constants/storageKeys'
import type { ActionbarDockState } from '@/platform/telemetry/types'

export function getActionbarDockState(): ActionbarDockState {
  return localStorage.getItem(ACTIONBAR_DOCKED_STORAGE_KEY) === 'false'
    ? 'floating'
    : 'docked'
}
