import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobMenu } from '@/composables/queue/useJobMenu'
import type { JobState } from '@/types/queue'

export type JobAction = {
  icon: string
  label: string
  variant: 'destructive' | 'secondary' | 'textonly'
}

const CANCELLABLE_STATES: JobState[] = ['pending', 'initialization', 'running']

export function useJobActions(
  job: MaybeRefOrGetter<JobListItem | null | undefined>
) {
  const { t } = useI18n()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()
  const { cancelJob } = useJobMenu()

  const cancelAction: JobAction = {
    icon: 'icon-[lucide--x]',
    label: t('sideToolbar.queueProgressOverlay.cancelJobTooltip'),
    variant: 'destructive'
  }

  const jobRef = computed(() => toValue(job) ?? null)

  const canCancelJob = computed(() => {
    const currentJob = jobRef.value
    if (!currentJob) {
      return false
    }

    return (
      currentJob.showClear !== false &&
      CANCELLABLE_STATES.includes(currentJob.state)
    )
  })

  const runCancelJob = wrapWithErrorHandlingAsync(async () => {
    const currentJob = jobRef.value
    if (!currentJob) {
      return
    }

    await cancelJob(currentJob)
  })

  return {
    cancelAction,
    canCancelJob,
    runCancelJob
  }
}
