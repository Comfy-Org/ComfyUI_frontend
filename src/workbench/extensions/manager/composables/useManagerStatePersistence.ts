import type { ManagerState } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import {
  ManagerTab,
  SortableAlgoliaField
} from '@/workbench/extensions/manager/types/comfyManagerTypes'

const STORAGE_KEY = 'Comfy.Manager.UI.State'

export function useManagerStatePersistence() {
  /**
   * Load the UI state from localStorage.
   */
  function loadStoredState(): ManagerState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
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
  function persistState(state: ManagerState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  /**
   * Reset the UI state to the default values.
   */
  function reset() {
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
