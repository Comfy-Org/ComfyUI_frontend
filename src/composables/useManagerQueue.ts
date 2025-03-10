import { useTimeoutPoll, whenever } from '@vueuse/core'
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
  const isServerIdle = computed(() => !serverQueueStatus.value.is_processing)

  const allJobsDone = computed(
    () => isServerIdle.value && clientQueueLength.value === 0
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
    if (allJobsDone.value && serverQueueStatus.value.done_count)
      return t('manager.queueStatus.allJobsDone')
    if (serverQueueStatus.value.in_progress_count > 0)
      return t('manager.queueStatus.waiting', {
        count: serverQueueStatus.value.in_progress_count,
        total: serverQueueStatus.value.total_count + clientQueueLength.value
      })
    return t('manager.queueStatus.error')
  })

  const startNextJob = async () => {
    const nextJob = clientQueueItems.value.shift()
    if (nextJob) {
      const { job, restartAfter = false } = nextJob
      await job()
      if (restartAfter) appNeedsRestart.value = true
    }
  }

  const startFirstJob = async () => {
    await startNextJob()
    if (!isPollingActive.value) resumePolling()
  }

  const onServerIdleChange = async (serverIdle: boolean) => {
    const shouldPausePolling = isPollingActive.value && allJobsDone.value
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
