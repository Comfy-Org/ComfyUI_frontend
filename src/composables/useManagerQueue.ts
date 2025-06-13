import { useEventListener, whenever } from '@vueuse/core'
import { Ref, computed, ref } from 'vue'

import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { components } from '@/types/generatedManagerTypes'

type ManagerTaskHistory = Record<
  string,
  components['schemas']['TaskHistoryItem']
>
type ManagerTaskQueue = components['schemas']['TaskStateMessage']
type ManagerWsTaskDoneMsg = components['schemas']['MessageTaskDone']
type ManagerWsTaskStartedMsg = components['schemas']['MessageTaskStarted']

const MANAGER_WS_TASK_DONE_NAME = 'cm-task-completed'
const MANAGER_WS_TASK_STARTED_NAME = 'cm-task-started'

export const useManagerQueue = (
  taskHistory: Ref<ManagerTaskHistory>,
  taskQueue: Ref<ManagerTaskQueue>,
  installedPacks: Ref<Record<string, any>>
) => {
  const { showManagerProgressDialog } = useDialogService()

  // Task queue state (read-only from server)
  const maxHistoryItems = ref(64)
  const isLoading = ref(false)
  const isProcessing = ref(false)

  // Computed values
  const currentQueueLength = computed(
    () =>
      taskQueue.value.running_queue.length +
      taskQueue.value.pending_queue.length
  )

  const updateProcessingState = () => {
    isProcessing.value = currentQueueLength.value > 0
  }

  const allTasksDone = computed(
    () => !isProcessing.value && currentQueueLength.value === 0
  )
  const historyCount = computed(() => Object.keys(taskHistory.value).length)

  // WebSocket event listener for task done
  const cleanupTaskDoneListener = useEventListener(
    api,
    MANAGER_WS_TASK_DONE_NAME,
    (event: CustomEvent<ManagerWsTaskDoneMsg>) => {
      if (event?.type === MANAGER_WS_TASK_DONE_NAME) {
        const { state } = event.detail
        taskQueue.value.running_queue = state.running_queue
        taskQueue.value.pending_queue = state.pending_queue
        taskHistory.value = state.history
        if (state.installed_packs) {
          console.log(
            'Updating installedPacks from WebSocket:',
            Object.keys(state.installed_packs)
          )
          installedPacks.value = state.installed_packs
        }
        updateProcessingState()
      }
    }
  )

  // WebSocket event listener for task started
  const cleanupTaskStartedListener = useEventListener(
    api,
    MANAGER_WS_TASK_STARTED_NAME,
    (event: CustomEvent<ManagerWsTaskStartedMsg>) => {
      if (event?.type === MANAGER_WS_TASK_STARTED_NAME) {
        const { state } = event.detail
        taskQueue.value.running_queue = state.running_queue
        taskQueue.value.pending_queue = state.pending_queue
        taskHistory.value = state.history
        if (state.installed_packs) {
          console.log(
            'Updating installedPacks from WebSocket:',
            Object.keys(state.installed_packs)
          )
          installedPacks.value = state.installed_packs
        }
        updateProcessingState()
      }
    }
  )

  whenever(currentQueueLength, () => showManagerProgressDialog())

  const stopListening = () => {
    cleanupTaskDoneListener()
    cleanupTaskStartedListener()
  }

  return {
    // Queue state (read-only from server)
    taskHistory,
    taskQueue,
    maxHistoryItems,
    isLoading,

    // Computed state
    allTasksDone,
    isProcessing,
    queueLength: currentQueueLength,
    historyCount,

    // Actions
    stopListening
  }
}
