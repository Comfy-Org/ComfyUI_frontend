import { useI18n } from 'vue-i18n'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobMenu } from '@/composables/queue/useJobMenu'
import type { JobState } from '@/types/queue'

type JobAction = {
  icon: string
  label: string
  variant: 'destructive' | 'secondary' | 'textonly'
}

export function useJobActions() {
  const { t } = useI18n()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()
  const { cancelJob } = useJobMenu()

  const cancelAction: JobAction = {
    icon: 'icon-[lucide--x]',
    label: t('sideToolbar.queueProgressOverlay.cancelJobTooltip'),
    variant: 'destructive'
  }

  const cancellableStates: JobState[] = ['pending', 'initialization', 'running']

  const canCancelJob = (job: JobListItem): boolean =>
    job.showClear !== false && cancellableStates.includes(job.state)

  const runCancelJob = wrapWithErrorHandlingAsync(async (job: JobListItem) => {
    await cancelJob(job)
  })

  return {
    cancelAction,
    canCancelJob,
    runCancelJob
  }
}
