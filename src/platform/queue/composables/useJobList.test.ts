import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { useJobModelDownloadStore } from '@/platform/queue/stores/jobModelDownloadStore'
import { useQueueStore } from '@/platform/queue/stores/queueStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useJobPreviewStore } from '@/stores/jobPreviewStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useJobList } from '@/platform/queue/composables/useJobList'
import type {
  JobState,
  BuildJobDisplayCtx
} from '@/platform/queue/presentation/queueDisplay'
import { buildJobDisplay } from '@/platform/queue/presentation/queueDisplay'
import type { JobListItem } from '@comfyorg/api-client/jobs/jobTypes'
import { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'

const createTestI18n = () =>
  createI18n({
    legacy: false,
    locale: 'en-US',
    messages: {
      'en-US': {
        queue: {
          jobList: {
            undated: 'Undated'
          },
          downloadingModel: 'Downloading {name}',
          downloadedOfTotal: '{downloaded} of {total}'
        },
        g: {
          emDash: '--',
          untitled: 'Untitled'
        }
      }
    }
  })

vi.mock(import('@/i18n'), () => ({
  st: vi.fn((key: string, fallback?: string) => `i18n(${key})-${fallback}`),
  resolveNodeDefText: vi.fn(
    (field: string, nodeName: string) => `i18n(${nodeName}.${field})`
  )
}))

function placeholderJobDisplay(
  task: TaskItemImpl,
  state: JobState,
  options: BuildJobDisplayCtx
) {
  return {
    primary: `Job ${task.jobId}`,
    secondary: `${state} meta`,
    iconName: `${state}-icon`,
    iconImageUrl: undefined,
    showClear: state === 'failed',
    options
  }
}

vi.mock(import('@/platform/queue/presentation/queueDisplay'), { spy: true })

let isJobInitializingMock: ReturnType<
  typeof useExecutionStore
>['isJobInitializing']

const createTask = (job: Partial<JobListItem> = {}) =>
  new TaskItemImpl(
    fromPartial<JobListItem>({
      id: `task-${Math.random().toString(36).slice(2, 7)}`,
      status: 'pending',
      priority: 0,
      ...job
    })
  )

const mountUseJobList = () => {
  let composable: ReturnType<typeof useJobList>
  const result = render(
    {
      template: '<div />',
      setup() {
        composable = useJobList()
        return {}
      }
    },
    {
      global: {
        plugins: [createTestI18n()]
      }
    }
  )
  return { ...result, composable: composable! }
}

const resetStores = () => {
  vi.mocked(buildJobDisplay).mockImplementation(placeholderJobDisplay)
  isJobInitializingMock = useExecutionStore().isJobInitializing
  const queueStore = useQueueStore()
  queueStore.pendingTasks = []
  queueStore.runningTasks = []
  queueStore.historyTasks = []

  const executionStore = useExecutionStore()
  executionStore.activeJobId = null
  Object.assign(executionStore, { executingNode: null })

  const jobPreviewStore = useJobPreviewStore()
  Object.assign(jobPreviewStore, { previewsByPromptId: {} })
  Object.assign(jobPreviewStore, { isPreviewEnabled: true })

  const workflowStore = useWorkflowStore()
  workflowStore.activeWorkflow = null

  vi.mocked(isJobInitializingMock).mockReturnValue(false)
}

const flush = async () => {
  await nextTick()
}

describe('useJobList', () => {
  let unmount: (() => void) | null = null
  let api: ReturnType<typeof useJobList> | null = null

  beforeEach(() => {
    resetStores()
    unmount?.()
    unmount = null
    api = null
  })

  afterEach(() => {
    unmount?.()
    unmount = null
    api = null
  })

  const initComposable = () => {
    const mounted = mountUseJobList()
    unmount = mounted.unmount
    api = mounted.composable
    return api
  }

  it('tracks recently added pending jobs and clears the hint after expiry', async () => {
    useQueueStore().pendingTasks = [
      createTask({ id: '1', priority: 1, status: 'pending' })
    ]

    const { jobItems } = initComposable()
    await flush()

    void jobItems.value
    expect(buildJobDisplay).toHaveBeenCalledWith(
      expect.anything(),
      'pending',
      expect.objectContaining({ showAddedHint: true })
    )

    vi.mocked(buildJobDisplay).mockClear()
    await vi.advanceTimersByTimeAsync(3000)
    await flush()

    void jobItems.value
    expect(buildJobDisplay).toHaveBeenCalledWith(
      expect.anything(),
      'pending',
      expect.objectContaining({ showAddedHint: false })
    )
  })

  it('removes pending hint immediately when the task leaves the queue', async () => {
    const taskId = '2'
    useQueueStore().pendingTasks = [
      createTask({ id: taskId, priority: 1, status: 'pending' })
    ]

    const { jobItems } = initComposable()
    await flush()
    void jobItems.value

    useQueueStore().pendingTasks = []
    await flush()
    expect(vi.getTimerCount()).toBe(0)

    vi.mocked(buildJobDisplay).mockClear()
    useQueueStore().pendingTasks = [
      createTask({ id: taskId, priority: 2, status: 'pending' })
    ]
    await flush()
    void jobItems.value
    expect(buildJobDisplay).toHaveBeenCalledWith(
      expect.anything(),
      'pending',
      expect.objectContaining({ showAddedHint: true })
    )
  })

  it('cleans up timeouts on unmount', async () => {
    useQueueStore().pendingTasks = [
      createTask({ id: '3', priority: 1, status: 'pending' })
    ]

    initComposable()
    await flush()
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount?.()
    unmount = null
    await flush()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sorts all tasks by create time', async () => {
    useQueueStore().pendingTasks = [
      createTask({
        id: 'p',
        priority: 1,
        status: 'pending',
        create_time: 3000
      })
    ]
    useQueueStore().runningTasks = [
      createTask({
        id: 'r',
        priority: 5,
        status: 'in_progress',
        create_time: 2000
      })
    ]
    useQueueStore().historyTasks = [
      createTask({
        id: 'h',
        priority: 3,
        status: 'completed',
        create_time: 1000,
        execution_end_time: 5000
      })
    ]

    const { allTasksSorted } = initComposable()
    await flush()

    expect(allTasksSorted.value.map((task) => task.jobId)).toEqual([
      'p',
      'r',
      'h'
    ])
  })

  it('filters by job tab and resets failed tab when failures disappear', async () => {
    useQueueStore().historyTasks = [
      createTask({ id: 'c', priority: 3, status: 'completed' }),
      createTask({ id: 'f', priority: 2, status: 'failed' }),
      createTask({ id: 'p', priority: 1, status: 'pending' })
    ]

    const instance = initComposable()
    await flush()

    instance.selectedJobTab.value = 'Completed'
    await flush()
    expect(instance.filteredTasks.value.map((t) => t.jobId)).toEqual(['c'])

    instance.selectedJobTab.value = 'Failed'
    await flush()
    expect(instance.filteredTasks.value.map((t) => t.jobId)).toEqual(['f'])
    expect(instance.hasFailedJobs.value).toBe(true)

    useQueueStore().historyTasks = [
      createTask({ id: 'c', priority: 3, status: 'completed' })
    ]
    await flush()

    expect(instance.hasFailedJobs.value).toBe(false)
    expect(instance.selectedJobTab.value).toBe('All')
  })

  it('filters by active workflow when requested', async () => {
    useQueueStore().pendingTasks = [
      createTask({
        id: 'wf-1',
        priority: 2,
        status: 'pending',
        workflow_id: 'workflow-1'
      }),
      createTask({
        id: 'wf-2',
        priority: 1,
        status: 'pending',
        workflow_id: 'workflow-2'
      })
    ]

    const instance = initComposable()
    await flush()

    instance.selectedWorkflowFilter.value = 'current'
    await flush()
    expect(instance.filteredTasks.value).toEqual([])

    useWorkflowStore().activeWorkflow = fromPartial<
      NonNullable<ReturnType<typeof useWorkflowStore>['activeWorkflow']>
    >({ activeState: { id: 'workflow-1' } })
    await flush()

    expect(instance.filteredTasks.value.map((t) => t.jobId)).toEqual(['wf-1'])
  })

  it('filters jobs by search query', async () => {
    useQueueStore().historyTasks = [
      createTask({
        id: 'alpha',
        priority: 2,
        status: 'completed',
        create_time: 2000,
        execution_end_time: 2000
      }),
      createTask({
        id: 'beta',
        priority: 1,
        status: 'failed',
        create_time: 1000,
        execution_end_time: 1000
      })
    ]

    const instance = initComposable()
    await flush()
    expect(instance.filteredTasks.value.map((task) => task.jobId)).toEqual([
      'alpha',
      'beta'
    ])

    instance.searchQuery.value = 'beta'
    await vi.advanceTimersByTimeAsync(200)
    await flush()
    expect(instance.filteredTasks.value.map((task) => task.jobId)).toEqual([
      'beta'
    ])

    instance.searchQuery.value = 'failed meta'
    await vi.advanceTimersByTimeAsync(200)
    await flush()
    expect(instance.filteredTasks.value.map((task) => task.jobId)).toEqual([
      'beta'
    ])

    instance.searchQuery.value = 'does-not-exist'
    await vi.advanceTimersByTimeAsync(200)
    await flush()
    expect(instance.filteredTasks.value).toEqual([])
  })

  it('hydrates job items with active progress and compute hours', async () => {
    useQueueStore().runningTasks = [
      createTask({
        id: 'active',
        priority: 3,
        status: 'in_progress',
        execution_start_time: 1_000,
        execution_end_time: 7_201_000
      }),
      createTask({
        id: 'other',
        priority: 2,
        status: 'in_progress',
        execution_start_time: 1_000,
        execution_end_time: 3_601_000
      })
    ]

    const executionStore = useExecutionStore()
    executionStore.activeJobId = 'active'
    Object.assign(executionStore, {
      executionProgressForJob: (jobId: string) =>
        jobId === 'active' ? 0.8 : 0,
      executingNodeProgressForJob: (jobId: string) =>
        jobId === 'active' ? 0.4 : null,
      executingNodeForJob: (jobId: string) =>
        jobId === 'active' ? { title: 'Render Node' } : null
    })

    const { jobItems } = initComposable()
    await flush()

    const [activeJob, otherJob] = jobItems.value
    expect(activeJob.progressTotalPercent).toBe(80)
    expect(activeJob.progressCurrentPercent).toBe(40)
    expect(activeJob.runningNodeName).toBe('Render Node')
    expect(activeJob.computeHours).toBeCloseTo(2)

    expect(otherJob.progressTotalPercent).toBeUndefined()
    expect(otherJob.progressCurrentPercent).toBeUndefined()
    expect(otherJob.runningNodeName).toBeUndefined()
    expect(otherJob.computeHours).toBeCloseTo(1)
  })

  function downloadingStyleLora(jobId: string) {
    vi.spyOn(useJobModelDownloadStore(), 'downloadFor').mockImplementation(
      (id) =>
        id === jobId
          ? {
              name: 'my_style_v2.safetensors',
              index: 1,
              count: 1,
              bytesDownloaded: 52428800,
              bytesTotal: 152043520,
              progress: 0.3448
            }
          : undefined
    )
  }

  it.for([
    { state: 'pending', status: 'pending', initializing: false },
    { state: 'initialization', status: 'pending', initializing: true },
    { state: 'running', status: 'in_progress', initializing: false }
  ] as const)(
    'shows the model download and its progress on a job in state $state',
    async ({ status, initializing }) => {
      vi.mocked(buildJobDisplay).mockReset()
      vi.mocked(isJobInitializingMock).mockReturnValue(initializing)
      useQueueStore().pendingTasks = [
        createTask({ id: 'downloading', status, create_time: 1 }),
        createTask({ id: 'other', status, create_time: 1 })
      ]

      downloadingStyleLora('downloading')
      const { jobItems } = initComposable()
      await flush()

      const items = new Map(jobItems.value.map((item) => [item.id, item]))
      expect(items.get('downloading')).toMatchObject({
        title: 'Downloading my_style_v2.safetensors',
        meta: '50 MB of 145 MB',
        progressTotalPercent: undefined
      })
      expect(items.get('downloading')?.progressCurrentPercent).toBeCloseTo(
        34.48
      )
      expect(items.get('other')?.title).not.toContain('Downloading')
      expect(items.get('other')?.progressCurrentPercent).toBeUndefined()
    }
  )

  it('shows the download, not node progress, on the active job', async () => {
    vi.mocked(buildJobDisplay).mockReset()
    useQueueStore().runningTasks = [
      createTask({ id: 'downloading', status: 'in_progress' })
    ]
    useExecutionStore().activeJobId = 'downloading'
    Object.assign(useExecutionStore(), {
      executionProgressForJob: () => 0.8,
      executingNodeProgressForJob: () => 0.5
    })

    downloadingStyleLora('downloading')
    const { jobItems } = initComposable()
    await flush()

    expect(jobItems.value[0]).toMatchObject({
      title: 'Downloading my_style_v2.safetensors',
      meta: '50 MB of 145 MB',
      progressTotalPercent: undefined
    })
    expect(jobItems.value[0].progressCurrentPercent).toBeCloseTo(34.48)
  })

  it('shows no download for a job that already finished', async () => {
    vi.mocked(buildJobDisplay).mockReset()
    useQueueStore().historyTasks = [
      createTask({ id: 'finished', status: 'completed' })
    ]

    downloadingStyleLora('finished')
    const { jobItems } = initComposable()
    await flush()

    expect(jobItems.value[0].title).not.toContain('Downloading')
    expect(jobItems.value[0].progressCurrentPercent).toBeUndefined()
  })

  it('assigns preview urls for running jobs when previews enabled', async () => {
    useQueueStore().runningTasks = [
      createTask({
        id: 'live-preview',
        priority: 1,
        status: 'in_progress'
      })
    ]
    Object.assign(useJobPreviewStore(), {
      previewsByPromptId: {
        'live-preview': 'blob:preview-url'
      }
    })
    Object.assign(useJobPreviewStore(), { isPreviewEnabled: true })

    const { jobItems } = initComposable()
    await flush()

    expect(jobItems.value[0].iconImageUrl).toBe('blob:preview-url')
  })

  it('omits preview urls when previews are disabled', async () => {
    useQueueStore().runningTasks = [
      createTask({
        id: 'disabled-preview',
        priority: 1,
        status: 'in_progress'
      })
    ]
    Object.assign(useJobPreviewStore(), {
      previewsByPromptId: {
        'disabled-preview': 'blob:preview-url'
      }
    })
    Object.assign(useJobPreviewStore(), { isPreviewEnabled: false })

    const { jobItems } = initComposable()
    await flush()

    expect(jobItems.value[0].iconImageUrl).toBeUndefined()
  })

  it('derives current node name from execution store fallbacks', async () => {
    const instance = initComposable()
    await flush()

    expect(instance.currentNodeName.value).toBe('--')

    useExecutionStore().activeJobId = 'active'
    Object.assign(useExecutionStore(), {
      executingNodeForJob: () => ({ title: '  Visible Node  ' })
    })
    await flush()
    expect(instance.currentNodeName.value).toBe('Visible Node')

    Object.assign(useExecutionStore(), {
      executingNodeForJob: () => ({
        title: '   ',
        type: 'My Node Type'
      })
    })
    await flush()
    expect(instance.currentNodeName.value).toBe(
      'i18n(My Node Type.display_name)'
    )
  })

  it('groups terminal jobs without an execution end timestamp by create time', async () => {
    useQueueStore().historyTasks = [
      createTask({
        id: 'failed-before-execution',
        priority: 1,
        status: 'failed',
        create_time: Date.now()
      }),
      createTask({
        id: 'completed-without-end-time',
        priority: 1,
        status: 'completed',
        create_time: Date.now() - 1_000
      })
    ]

    const instance = initComposable()
    await flush()

    const groups = instance.groupedJobItems.value
    expect(groups.map((g) => g.label)).toEqual(['Today'])
    expect(groups[0].items.map((item) => item.id)).toEqual([
      'failed-before-execution',
      'completed-without-end-time'
    ])
  })

  it('groups job items by date label and sorts by total generation time when requested', async () => {
    useQueueStore().historyTasks = [
      createTask({
        id: 'today-small',
        priority: 4,
        status: 'completed',
        execution_start_time: Date.now() - 2_000,
        execution_end_time: Date.now()
      }),
      createTask({
        id: 'today-large',
        priority: 3,
        status: 'completed',
        execution_start_time: Date.now() - 5_000,
        execution_end_time: Date.now()
      }),
      createTask({
        id: 'yesterday',
        priority: 2,
        status: 'failed',
        execution_start_time: Date.now() - 86_400_000 - 1_000,
        execution_end_time: Date.now() - 86_400_000
      }),
      createTask({
        id: 'undated',
        priority: 1,
        status: 'pending'
      })
    ]

    const instance = initComposable()
    instance.selectedSortMode.value = 'totalGenerationTime'
    await flush()

    const groups = instance.groupedJobItems.value
    expect(groups.map((g) => g.label)).toEqual([
      'Today',
      'Yesterday',
      'Undated'
    ])

    const todayGroup = groups[0]
    expect(todayGroup.items.map((item) => item.id)).toEqual([
      'today-large',
      'today-small'
    ])
  })
})
