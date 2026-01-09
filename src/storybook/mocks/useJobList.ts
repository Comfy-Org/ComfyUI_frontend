import { computed, ref } from 'vue'

import type { TaskItemImpl } from '@/queue/stores/queueStore'
import type {
  JobGroup,
  JobListItem,
  JobSortMode,
  JobTab
} from '@/queue/composables/useJobList'

const jobItems = ref<JobListItem[]>([])

function buildGroupedJobItems(): JobGroup[] {
  return [
    {
      key: 'storybook',
      label: 'Storybook',
      items: jobItems.value
    }
  ]
}

const groupedJobItems = computed<JobGroup[]>(buildGroupedJobItems)

const selectedJobTab = ref<JobTab>('All')
const selectedWorkflowFilter = ref<'all' | 'current'>('all')
const selectedSortMode = ref<JobSortMode>('mostRecent')
const currentNodeName = ref('KSampler')
function buildEmptyTasks(): TaskItemImpl[] {
  return []
}

const allTasksSorted = computed<TaskItemImpl[]>(buildEmptyTasks)
const filteredTasks = computed<TaskItemImpl[]>(buildEmptyTasks)

function buildHasFailedJobs() {
  return jobItems.value.some((item) => item.state === 'failed')
}

const hasFailedJobs = computed(buildHasFailedJobs)

export function setMockJobItems(items: JobListItem[]) {
  jobItems.value = items
}

/** @knipIgnoreUnusedButUsedByStorybook */
export function useJobList() {
  return {
    selectedJobTab,
    selectedWorkflowFilter,
    selectedSortMode,
    hasFailedJobs,
    allTasksSorted,
    filteredTasks,
    jobItems,
    groupedJobItems,
    currentNodeName
  }
}
