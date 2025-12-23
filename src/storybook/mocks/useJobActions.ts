import { ref } from 'vue'

import type { JobAction } from '../../composables/queue/useJobActions'
import type { JobListItem } from '../../composables/queue/useJobList'

const actionsByJobId = ref<Record<string, JobAction[]>>({})

export function setMockJobActions(actions: Record<string, JobAction[]>) {
  actionsByJobId.value = actions
}

/** @knipIgnoreUnusedButUsedByStorybook */
export function useJobActions() {
  function getJobActions(job: JobListItem) {
    return actionsByJobId.value[job.id] ?? []
  }

  async function runJobAction() {
    return undefined
  }

  return {
    getJobActions,
    runJobAction
  }
}
