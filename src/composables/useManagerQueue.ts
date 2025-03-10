import { useTimeoutPoll, watchDebounced, whenever } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { t } from '@/i18n'
import { useComfyManagerService } from '@/services/comfyManagerService'
import type { ManagerQueueStatus } from '@/types/comfyManagerTypes'

type ClientQueueItem<T> = {
  job: () => Promise<T>
  restartAfter?: boolean
}

const QUEUE_POLL_INTERVAL_MS = 1024

/**
 * Composable to manage the queue of jobs to be executed by the manager
 */
export const useManagerQueue = () => {
  const managerService = useComfyManagerService()
  const appNeedsRestart = ref(false)

  const clientQueueItems = ref<ClientQueueItem<unknown>[]>([])
  const clientQueueLength = computed(() => clientQueueItems.value.length)

  const serverQueueStatus = ref<ManagerQueueStatus>({
    total_count: 0,
    done_count: 0,
    in_progress_count: 0,
    is_processing: false
  })
  const isServerIdle = computed(
    () =>
      !serverQueueStatus.value.is_processing &&
      serverQueueStatus.value.in_progress_count === 0
  )

  const allJobsDone = ref(false)
  watchDebounced(
    [isServerIdle, clientQueueLength],
    () => {
      const jobsStatus = isServerIdle.value && clientQueueLength.value === 0
      if (jobsStatus !== allJobsDone.value) allJobsDone.value = jobsStatus
    },
    { debounce: QUEUE_POLL_INTERVAL_MS + 64 }
  )
  const nextJobReady = computed(
    () => isServerIdle.value && clientQueueLength.value > 0
  )

  const getServerQueueStatus = async () => {
    const status = await managerService.getQueueStatus()
    if (status) serverQueueStatus.value = status
  }

  const {
    isActive: isPollingActive,
    pause: pausePolling,
    resume: resumePolling
  } = useTimeoutPoll(getServerQueueStatus, QUEUE_POLL_INTERVAL_MS)

  const statusMessage = computed(() => {
    if (nextJobReady.value) return t('manager.queueStatus.nextJob')
    if (allJobsDone.value) return t('manager.queueStatus.allJobsDone')
    if (
      serverQueueStatus.value.is_processing &&
      serverQueueStatus.value.in_progress_count < 1
    ) {
      const count = serverQueueStatus.value.in_progress_count
      const total =
        Math.min(serverQueueStatus.value.total_count, count) +
        clientQueueLength.value
      return t('manager.queueStatus.waiting', {
        count,
        total
      })
    }
    return t('manager.queueStatus.processingJob')
  })

  const startNextJob = async () => {
    serverQueueStatus.value.is_processing = true
    const nextJob = clientQueueItems.value.shift()
    if (nextJob) {
      const { job, restartAfter = false } = nextJob
      await job()
      if (restartAfter) appNeedsRestart.value = true
    } else {
      serverQueueStatus.value.is_processing = false
    }
  }

  const startFirstJob = async () => {
    await startNextJob()
    if (!isPollingActive.value) resumePolling()
  }

  const onServerIdleChange = async (serverIdle: boolean) => {
    const shouldPausePolling =
      isPollingActive.value && isServerIdle.value && !clientQueueLength.value
    const shouldResumePolling = !isPollingActive.value && !serverIdle

    if (shouldPausePolling) pausePolling()
    else if (shouldResumePolling) resumePolling()
    else if (nextJobReady.value) await startNextJob()
  }

  watch(isServerIdle, onServerIdleChange)
  whenever(clientQueueLength, startFirstJob)

  return {
    appNeedsRestart,
    statusMessage,
    allJobsDone,
    enqueueJob: (job: ClientQueueItem<unknown>) => {
      clientQueueItems.value.push(job)
    }
  }
}
