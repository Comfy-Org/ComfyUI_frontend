import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobMenu } from '@/composables/queue/useJobMenu'
import type { JobState } from '@/types/queue'

export type JobActionKey = 'cancel'

export type JobAction = {
  key: JobActionKey
  icon: string
  label: string
  variant: 'destructive' | 'secondary' | 'textonly'
}

export function useJobActions() {
  const { t } = useI18n()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()
  const currentJob = ref<JobListItem | null>(null)
  const { cancelJob } = useJobMenu(() => currentJob.value)

  const jobActionSets = computed<Partial<Record<JobState, JobAction[]>>>(() => {
    const cancelAction: JobAction = {
      key: 'cancel',
      icon: 'icon-[lucide--x]',
      label: t('sideToolbar.queueProgressOverlay.cancelJobTooltip'),
      variant: 'destructive'
    }

    return {
      pending: [cancelAction],
      initialization: [cancelAction],
      running: [cancelAction]
    }
  })

  const getJobActions = (job: JobListItem): JobAction[] =>
    job.showClear === false ? [] : (jobActionSets.value[job.state] ?? [])

  const runJobAction = wrapWithErrorHandlingAsync(
    async (action: JobAction, job: JobListItem) => {
      currentJob.value = job

      if (action.key === 'cancel') {
        await cancelJob()
      }
    }
  )

  return {
    getJobActions,
    runJobAction
  }
}
