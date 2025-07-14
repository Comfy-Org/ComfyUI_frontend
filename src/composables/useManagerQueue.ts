import { useEventListener, whenever } from '@vueuse/core'
import { pickBy } from 'lodash'
import { Ref, computed, ref } from 'vue'

import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { components } from '@/types/generatedManagerTypes'

type ManagerTaskHistory = Record<
  string,
  components['schemas']['TaskHistoryItem']
>
type ManagerTaskQueue = components['schemas']['TaskStateMessage']
type ManagerWsTaskDoneMsg = components['schemas']['MessageTaskDone']
type ManagerWsTaskStartedMsg = components['schemas']['MessageTaskStarted']
type QueueTaskItem = components['schemas']['QueueTaskItem']
type HistoryTaskItem = components['schemas']['TaskHistoryItem']
type Task = QueueTaskItem | HistoryTaskItem

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

  /**
   * Update the processing state based on the current queue length.
   * If the queue is empty, or all tasks in the queue are associated
   * with different clients, then this client is not processing any tasks.
   */
  const updateProcessingState = (): void => {
    isProcessing.value = currentQueueLength.value > 0
  }

  const allTasksDone = computed(() => currentQueueLength.value === 0)
  const historyCount = computed(() => Object.keys(taskHistory.value).length)

  /**
   * Check if a task is associated with this client.
   * Task can be from running queue, pending queue, or history.
   * @param task - The task to check
   * @returns True if the task belongs to this client
   */
  const isTaskFromThisClient = (task: Task): boolean =>
    task.client_id === app.api.clientId

  /**
   * Filter queue tasks by client id.
   * Ensures that only tasks associated with this client are processed and
   * added to client state.
   * @param tasks - Array of queue tasks to filter
   * @returns Filtered array containing only tasks from this client
   */
  const filterQueueByClientId = (tasks: QueueTaskItem[]): QueueTaskItem[] =>
    tasks.filter(isTaskFromThisClient)

  /**
   * Filter history tasks by client id using lodash pickBy for optimal performance.
   * Returns a new object containing only tasks associated with this client.
   * @param history - The history object to filter
   * @returns Filtered history object containing only tasks from this client
   */
  const filterHistoryByClientId = (history: ManagerTaskHistory) =>
    pickBy(history, isTaskFromThisClient)

  /**
   * Update task queue and history state with filtered data from server.
   * Ensures only tasks from this client are stored in local state.
   * @param state - The task state message from the server
   */
  const updateTaskState = (state: ManagerTaskQueue) => {
    taskQueue.value.running_queue = filterQueueByClientId(state.running_queue)
    taskQueue.value.pending_queue = filterQueueByClientId(state.pending_queue)
    taskHistory.value = filterHistoryByClientId(state.history)

    if (state.installed_packs) {
      installedPacks.value = state.installed_packs
    }
    updateProcessingState()
  }

  // WebSocket event listener for task done
  const cleanupTaskDoneListener = useEventListener(
    app.api,
    MANAGER_WS_TASK_DONE_NAME,
    (event: CustomEvent<ManagerWsTaskDoneMsg>) => {
      if (event?.type === MANAGER_WS_TASK_DONE_NAME) {
        const { state } = event.detail
        updateTaskState(state)
      }
    }
  )

  // WebSocket event listener for task started
  const cleanupTaskStartedListener = useEventListener(
    app.api,
    MANAGER_WS_TASK_STARTED_NAME,
    (event: CustomEvent<ManagerWsTaskStartedMsg>) => {
      if (event?.type === MANAGER_WS_TASK_STARTED_NAME) {
        const { state } = event.detail
        updateTaskState(state)
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
