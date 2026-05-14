import { computed, ref } from 'vue'

import type { TaskItemImpl } from '../../stores/queueStore'
import type {
  JobGroup,
  JobListItem,
  JobSortMode,
  JobTab
} from '../../composables/queue/useJobList'

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

export const jobTabs = ['All', 'Completed', 'Failed', 'Cancelled'] as const
export const jobSortModes = ['mostRecent', 'totalGenerationTime'] as const

const selectedJobTab = ref<JobTab>('All')
const selectedWorkflowFilter = ref<'all' | 'current'>('all')
const selectedSortMode = ref<JobSortMode>('mostRecent')
const searchQuery = ref('')
const currentNodeName = ref('KSampler')
function buildEmptyTasks(): TaskItemImpl[] {
  return []
}

const allTasksSorted = computed<TaskItemImpl[]>(buildEmptyTasks)
const filteredTasks = computed<TaskItemImpl[]>(buildEmptyTasks)

function buildHasFailedJobs() {
  return jobItems.value.some((item) => item.state === 'failed')
}

function buildHasCancelledJobs() {
  return jobItems.value.some((item) => item.state === 'cancelled')
}

const hasFailedJobs = computed(buildHasFailedJobs)
const hasCancelledJobs = computed(buildHasCancelledJobs)

export function setMockJobItems(items: JobListItem[]) {
  jobItems.value = items
}

export function useJobList() {
  return {
    selectedJobTab,
    selectedWorkflowFilter,
    selectedSortMode,
    searchQuery,
    hasFailedJobs,
    hasCancelledJobs,
    allTasksSorted,
    filteredTasks,
    jobItems,
    groupedJobItems,
    currentNodeName
  }
}
