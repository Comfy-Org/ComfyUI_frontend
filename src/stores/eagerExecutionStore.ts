import { defineStore } from 'pinia'
import { ref } from 'vue'

import { eagerExecutionService } from '@/services/eagerExecutionService'

/**
 * Store for managing eager execution settings and state
 */
export const useEagerExecutionStore = defineStore('eagerExecution', () => {
  // State
  const enabled = ref(false)

  // Actions

  /**
   * Enable eager execution
   */
  async function enable() {
    enabled.value = true
    await eagerExecutionService.enable()
  }

  /**
   * Disable eager execution
   */
  function disable() {
    enabled.value = false
    eagerExecutionService.disable()
  }

  /**
   * Toggle eager execution
   */
  async function toggle() {
    if (enabled.value) {
      disable()
    } else {
      await enable()
    }
  }

  return {
    // State
    enabled,

    // Actions
    enable,
    disable,
    toggle
  }
})
