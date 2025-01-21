import type { InstallValidation } from '@comfyorg/comfyui-electron-types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { DESKTOP_MAINTENANCE_TASKS } from '@/constants/desktopMaintenanceTasks'
import type {
  MaintenanceTask,
  MaintenanceTaskState
} from '@/types/desktop/maintenanceTypes'
import { electronAPI } from '@/utils/envUtil'
import { useMinLoadingDurationRef } from '@/utils/refUtil'

/**
 * User-initiated maintenance tasks.  Currently only used by the desktop app maintenance view.
 *
 * Includes running state, task list, and execution / refresh logic.
 * @returns The maintenance task store
 */
export const useMaintenanceTaskStore = defineStore('maintenanceTask', () => {
  /** Refresh should run for at least this long, even if it completes much faster. Ensures refresh feels like it is doing something. */
  const minRefreshTime = 250
  const electron = electronAPI()

  // Reactive state
  const isRefreshing = useMinLoadingDurationRef(false, minRefreshTime)
  const isRunningTerminalCommand = computed(() =>
    tasks.value
      .filter((task) => task.usesTerminal)
      .some((task) => getState(task)?.executing)
  )
  const isRunningInstallationFix = computed(() =>
    tasks.value
      .filter((task) => task.isInstallationFix)
      .some((task) => getState(task)?.executing)
  )

  // Task list
  const tasks = ref(DESKTOP_MAINTENANCE_TASKS)

  // Assemble a task to state map
  const rawTaskStateMap = new Map<MaintenanceTask['id'], MaintenanceTaskState>()

  for (const task of DESKTOP_MAINTENANCE_TASKS) {
    // Use a minimum run time to ensure tasks "feel" like they have run
    rawTaskStateMap.set(task.id, {
      loading: useMinLoadingDurationRef(true, minRefreshTime),
      executing: useMinLoadingDurationRef(false, minRefreshTime)
    })
  }
  const taskStates = ref(rawTaskStateMap)

  /** True if any tasks are in an error state. */
  const anyErrors = computed(() =>
    tasks.value.some((task) => getState(task).state === 'error')
  )

  /** Wraps the execution of a maintenance task, updating state and rethrowing errors. */
  const execute = async (task: MaintenanceTask) => {
    const state = getState(task)

    try {
      state.executing = true
      const success = await task.execute()
      if (!success) return false

      state.error = undefined
      return true
    } catch (error) {
      state.error = (error as Error)?.message
      throw error
    } finally {
      state.executing = false
    }
  }

  /**
   * Returns the matching state object for a task.
   * @param task Task to get the matching state object for
   * @returns The state object for this task
   */
  const getState = (task: MaintenanceTask) => taskStates.value.get(task.id)!

  /**
   * Updates the task list with the latest validation state.
   * @param validationUpdate Update details passed in by electron
   */
  const processUpdate = (validationUpdate: InstallValidation) => {
    // Type not exported by API
    type ValidationState = InstallValidation['basePath']
    // Add index to API type
    type IndexedUpdate = InstallValidation & Record<string, ValidationState>

    const update = validationUpdate as IndexedUpdate
    isRefreshing.value = true

    // Update each task state
    for (const task of tasks.value) {
      const state = getState(task)

      state.loading = update[task.id] === undefined
      // Mark resolved
      if (state.state === 'error' && update[task.id] === 'OK')
        state.resolved = true
      if (update[task.id]) state.state = update[task.id]
    }

    // Final update
    if (!update.inProgress && isRefreshing.value) {
      isRefreshing.value = false

      for (const task of tasks.value) {
        const state = getState(task)
        state.state = update[task.id] ?? 'skipped'
        state.loading = false
      }
    }
  }

  /** Clears the resolved status of tasks (when changing filters) */
  const clearResolved = () => {
    for (const task of tasks.value) {
      const state = getState(task)
      if (state) state.resolved &&= false
    }
  }

  /** @todo Refreshes Electron tasks only. */
  const refreshDesktopTasks = async () => {
    isRefreshing.value = true
    console.log('Refreshing desktop tasks')
    await electron.Validation.validateInstallation(processUpdate)
    isRefreshing.value = false
  }

  return {
    tasks,
    isRefreshing,
    isRunningTerminalCommand,
    isRunningInstallationFix,
    execute,
    getState,
    processUpdate,
    clearResolved,
    /** True if any tasks are in an error state. */
    anyErrors,
    refreshDesktopTasks
  }
})
