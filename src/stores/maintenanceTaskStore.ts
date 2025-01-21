// @ts-strict-ignore
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

export const useMaintenanceTaskStore = defineStore('maintenanceTask', () => {
  /** Refresh should run for at least this long, even if it completes much faster. Ensures refresh feels like it is doing something. */
  const minRefreshTime = 250
  const electron = electronAPI()

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

  const taskStateMap = new Map<string, MaintenanceTaskState>()

  // Use a minimum run time to ensure tasks "feel" like they have run
  for (const task of DESKTOP_MAINTENANCE_TASKS) {
    taskStateMap.set(task.id, {
      loading: useMinLoadingDurationRef(true, minRefreshTime),
      executing: useMinLoadingDurationRef(false, minRefreshTime)
    })
  }

  const taskMap = new Map<string, MaintenanceTask>(
    DESKTOP_MAINTENANCE_TASKS.map((task) => [task.id, task])
  )

  const tasks = ref<ReadonlyArray<MaintenanceTask>>(DESKTOP_MAINTENANCE_TASKS)
  const taskStates = ref<Map<string, MaintenanceTaskState>>(taskStateMap)

  /** True if any tasks are in an error state. */
  const anyErrors = computed(() =>
    [...taskStates.value.values()].some((x) => x.state === 'error')
  )

  const execute = async (task: MaintenanceTask) => {
    const state = getState(task)
    console.log('executing', task.id, task)
    state.executing = true

    try {
      const success = await task.execute()
      if (!success) throw new Error('Task failed to run.')
      state.error = undefined
    } catch (error) {
      state.error =
        (error as Error)?.message ??
        'An error occurred while running a maintenance task.'
    }
    state.executing = false
  }

  const getState = (task: MaintenanceTask) => taskStates.value.get(task.id)!

  /**
   * Updates the task list with the latest validation state.
   * @param update Update details passed in by electron
   */
  const processUpdate = (update: InstallValidation) => {
    // console.log('processUpdate', update)
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
