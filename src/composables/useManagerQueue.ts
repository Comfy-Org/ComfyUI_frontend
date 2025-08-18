import { useEventListener, whenever } from '@vueuse/core'
import { computed, readonly, ref } from 'vue'

import { api } from '@/scripts/api'
import { ManagerWsQueueStatus } from '@/types/comfyManagerTypes'

type QueuedTask<T> = {
  task: () => Promise<T>
  onComplete?: () => void
}

const MANAGER_WS_MSG_TYPE = 'cm-queue-status'

export const useManagerQueue = () => {
  const clientQueueItems = ref<QueuedTask<unknown>[]>([])
  const clientQueueLength = computed(() => clientQueueItems.value.length)
  const onCompletedQueue = ref<((() => void) | undefined)[]>([])
  const onCompleteWaitingCount = ref(0)
  const uncompletedCount = computed(
    () => clientQueueLength.value + onCompleteWaitingCount.value
  )

  const serverQueueStatus = ref<ManagerWsQueueStatus>(ManagerWsQueueStatus.DONE)
  const isServerIdle = computed(
    () => serverQueueStatus.value === ManagerWsQueueStatus.DONE
  )

  const allTasksDone = computed(
    () => isServerIdle.value && clientQueueLength.value === 0
  )
  const nextTaskReady = computed(
    () => isServerIdle.value && clientQueueLength.value > 0
  )

  const cleanupListener = useEventListener(
    api,
    MANAGER_WS_MSG_TYPE,
    (event: CustomEvent<{ status: ManagerWsQueueStatus }>) => {
      if (event?.type === MANAGER_WS_MSG_TYPE && event.detail?.status) {
        serverQueueStatus.value = event.detail.status
      }
    }
  )

  const startNextTask = () => {
    const nextTask = clientQueueItems.value.shift()
    if (!nextTask) return

    const { task, onComplete } = nextTask
    if (onComplete) {
      // Set the task's onComplete to be executed the next time the server is idle
      onCompletedQueue.value.push(onComplete)
      onCompleteWaitingCount.value++
    }

    task().catch((e) => {
      const message = `Error enqueuing task for ComfyUI Manager: ${e}`
      console.error(message)
    })
  }

  const enqueueTask = <T>(task: QueuedTask<T>): void => {
    clientQueueItems.value.push(task)
  }

  const clearQueue = () => {
    clientQueueItems.value = []
    onCompletedQueue.value = []
    onCompleteWaitingCount.value = 0
  }

  const cleanup = () => {
    clearQueue()
    cleanupListener()
  }

  whenever(nextTaskReady, startNextTask)
  whenever(isServerIdle, () => {
    if (onCompletedQueue.value?.length) {
      while (
        onCompleteWaitingCount.value > 0 &&
        onCompletedQueue.value.length > 0
      ) {
        const onComplete = onCompletedQueue.value.shift()
        onComplete?.()
        onCompleteWaitingCount.value--
      }
    }
  })

  return {
    allTasksDone,
    statusMessage: readonly(serverQueueStatus),
    queueLength: clientQueueLength,
    uncompletedCount,

    enqueueTask,
    clearQueue,
    cleanup
  }
}
