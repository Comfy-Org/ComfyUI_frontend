import { useEventListener, whenever } from '@vueuse/core'
import { computed, readonly, ref } from 'vue'

import { api } from '@/scripts/api'

type QueuedJob<T> = {
  job: () => Promise<T>
  onComplete?: () => void
}

const MANAGER_WS_MSG_TYPE = 'cm-queue-status'

enum ManagerWsQueueStatus {
  DONE = 'done',
  IN_PROGRESS = 'in_progress'
}

export const useManagerQueue = () => {
  const clientQueueItems = ref<QueuedJob<unknown>[]>([])
  const clientQueueLength = computed(() => clientQueueItems.value.length)
  const nextOnCompleted = ref<(() => void) | undefined>()

  const serverQueueStatus = ref<ManagerWsQueueStatus>(ManagerWsQueueStatus.DONE)
  const isServerIdle = computed(
    () => serverQueueStatus.value === ManagerWsQueueStatus.DONE
  )

  const allJobsDone = computed(
    () => isServerIdle.value && clientQueueLength.value === 0
  )
  const nextJobReady = computed(
    () => isServerIdle.value && clientQueueLength.value > 0
  )

  useEventListener(
    api,
    MANAGER_WS_MSG_TYPE,
    (event: CustomEvent<{ status: ManagerWsQueueStatus }>) => {
      if (event?.type === MANAGER_WS_MSG_TYPE && event.detail?.status) {
        serverQueueStatus.value = event.detail.status
      }
    }
  )

  const startNextJob = () => {
    const nextJob = clientQueueItems.value.shift()
    if (!nextJob) return

    const { job, onComplete } = nextJob

    job()
      .then(() => {
        // Queue the job's onComplete callback to be executed after the server is idle
        nextOnCompleted.value = onComplete
      })
      .catch((e) => {
        const message = `Error enqueuing job for ComfyUI Manager: ${e}`
        console.error(message)
      })
  }

  const enqueueJob = <T>(job: QueuedJob<T>): void => {
    clientQueueItems.value.push(job)
  }

  const clearQueue = () => {
    clientQueueItems.value = []
  }

  whenever(nextJobReady, startNextJob)
  whenever(isServerIdle, () => {
    if (nextOnCompleted.value) {
      nextOnCompleted.value()
      nextOnCompleted.value = undefined
    }
  })

  return {
    allJobsDone,
    statusMessage: readonly(serverQueueStatus),
    queueLength: clientQueueLength,

    enqueueJob,
    clearQueue
  }
}
