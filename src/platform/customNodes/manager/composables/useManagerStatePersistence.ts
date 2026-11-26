import type { ManagerState } from '@/platform/customNodes/manager/types/comfyManagerTypes'
import {
  ManagerTab,
  SortableAlgoliaField
} from '@/platform/customNodes/manager/types/comfyManagerTypes'
import { reportError } from '@comfyorg/telemetry/reportError'

import { safeLocalStorage } from '@comfyorg/shared-frontend-utils/safeStorage'

const STORAGE_KEY = 'Comfy.Manager.UI.State'

let writeFailureReported = false

export const useManagerStatePersistence = () => {
  /**
   * Load the UI state from localStorage.
   */
  const loadStoredState = (): ManagerState => {
    try {
      const stored = safeLocalStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load manager UI state:', e)
    }
    return {
      selectedTabId: ManagerTab.All,
      searchQuery: '',
      searchMode: 'packs',
      sortField: SortableAlgoliaField.Downloads
    }
  }

  /**
   * Persist the UI state to localStorage.
   */
  const persistState = (state: ManagerState) => {
    const outcome = safeLocalStorage.write(STORAGE_KEY, JSON.stringify(state))
    if (outcome.result !== 'failed' || writeFailureReported) return
    if (
      outcome.error instanceof DOMException &&
      outcome.error.name === 'SecurityError'
    )
      return
    writeFailureReported = true
    reportError(outcome.error, {
      surface: 'platform',
      errorType: 'error_persisting_manager_ui_state',
      level: 'warning'
    })
  }

  /**
   * Reset the UI state to the default values.
   */
  const reset = () => {
    persistState({
      selectedTabId: ManagerTab.All,
      searchQuery: '',
      searchMode: 'packs',
      sortField: SortableAlgoliaField.Downloads
    })
  }

  return {
    loadStoredState,
    persistState,
    reset
  }
}
