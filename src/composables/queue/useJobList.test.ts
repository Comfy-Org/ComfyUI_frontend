import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { useQueueStore } from '@/stores/queueStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useJobPreviewStore } from '@/stores/jobPreviewStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useJobList } from '@/composables/queue/useJobList'
import type { JobState } from '@/types/queue'
import type { BuildJobDisplayCtx } from '@/utils/queueDisplay'
import { buildJobDisplay } from '@/utils/queueDisplay'
import type { TaskItemImpl } from '@/stores/queueStore'

type TestTask = {
  jobId: string
  job: { priority: number }
  mockState: JobState
  executionTime?: number
  executionEndTimestamp?: number
  createTime?: number
  workflowId?: string
}

const createTestI18n = () =>
  createI18n({
    legacy: false,
    locale: 'en-US',
    messages: {
      'en-US': {
        queue: {
          jobList: {
            undated: 'Undated'
          }
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

let totalPercent: Ref<number> | undefined
let currentNodePercent: Ref<number> | undefined
const ensureProgressRefs = () => {
  if (!totalPercent) totalPercent = ref(0)
  if (!currentNodePercent) currentNodePercent = ref(0)
  return { totalPercent, currentNodePercent }
}
vi.mock<unknown>(import('@/composables/queue/useQueueProgress'), () => ({
  useQueueProgress: () => {
    return ensureProgressRefs()
  }
}))

vi.mock(import('@/utils/queueDisplay'), () => ({
  buildJobDisplay: vi.fn(
    (task: TaskItemImpl, state: JobState, options: BuildJobDisplayCtx) => ({
      primary: `Job ${task.jobId}`,
      secondary: `${state} meta`,
      iconName: `${state}-icon`,
      iconImageUrl: undefined,
      showClear: state === 'failed',
      options
    })
  )
}))

vi.mock<unknown>(import('@/utils/queueUtil'), () => ({
  jobStateFromTask: vi.fn((task: TestTask): JobState => task.mockState)
}))

let isJobInitializingMock: ReturnType<
  typeof useExecutionStore
>['isJobInitializing']

const createTask = (
  overrides: Partial<TestTask> & { mockState?: JobState } = {}
): TaskItemImpl & TestTask =>
  fromPartial<TaskItemImpl & TestTask>({
    jobId: overrides.jobId ?? `task-${Math.random().toString(36).slice(2, 7)}`,
    job: overrides.job ?? { priority: 0 },
    mockState: overrides.mockState ?? 'pending',
    executionTime: overrides.executionTime,
    executionEndTimestamp: overrides.executionEndTimestamp,
    createTime: overrides.createTime,
    workflowId: overrides.workflowId
  })

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

  const progress = ensureProgressRefs()
  progress.totalPercent.value = 0
  progress.currentNodePercent.value = 0

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
      createTask({ jobId: '1', job: { priority: 1 }, mockState: 'pending' })
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
      createTask({ jobId: taskId, job: { priority: 1 }, mockState: 'pending' })
    ]

    const { jobItems } = initComposable()
    await flush()
    void jobItems.value

    useQueueStore().pendingTasks = []
    await flush()
    expect(vi.getTimerCount()).toBe(0)

    vi.mocked(buildJobDisplay).mockClear()
    useQueueStore().pendingTasks = [
      createTask({ jobId: taskId, job: { priority: 2 }, mockState: 'pending' })
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
      createTask({ jobId: '3', job: { priority: 1 }, mockState: 'pending' })
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
        jobId: 'p',
        job: { priority: 1 },
        mockState: 'pending',
        createTime: 3000
      })
    ]
    useQueueStore().runningTasks = [
      createTask({
        jobId: 'r',
        job: { priority: 5 },
        mockState: 'running',
        createTime: 2000
      })
    ]
    useQueueStore().historyTasks = [
      createTask({
        jobId: 'h',
        job: { priority: 3 },
        mockState: 'completed',
        createTime: 1000,
        executionEndTimestamp: 5000
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
      createTask({ jobId: 'c', job: { priority: 3 }, mockState: 'completed' }),
      createTask({ jobId: 'f', job: { priority: 2 }, mockState: 'failed' }),
      createTask({ jobId: 'p', job: { priority: 1 }, mockState: 'pending' })
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
      createTask({ jobId: 'c', job: { priority: 3 }, mockState: 'completed' })
    ]
    await flush()

    expect(instance.hasFailedJobs.value).toBe(false)
    expect(instance.selectedJobTab.value).toBe('All')
  })

  it('filters by active workflow when requested', async () => {
    useQueueStore().pendingTasks = [
      createTask({
        jobId: 'wf-1',
        job: { priority: 2 },
        mockState: 'pending',
        workflowId: 'workflow-1'
      }),
      createTask({
        jobId: 'wf-2',
        job: { priority: 1 },
        mockState: 'pending',
        workflowId: 'workflow-2'
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
        jobId: 'alpha',
        job: { priority: 2 },
        mockState: 'completed',
        createTime: 2000,
        executionEndTimestamp: 2000
      }),
      createTask({
        jobId: 'beta',
        job: { priority: 1 },
        mockState: 'failed',
        createTime: 1000,
        executionEndTimestamp: 1000
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
        jobId: 'active',
        job: { priority: 3 },
        mockState: 'running',
        executionTime: 7_200_000
      }),
      createTask({
        jobId: 'other',
        job: { priority: 2 },
        mockState: 'running',
        executionTime: 3_600_000
      })
    ]

    const executionStore = useExecutionStore()
    executionStore.activeJobId = 'active'
    Object.assign(executionStore, { executingNode: { title: 'Render Node' } })
    const progress = ensureProgressRefs()
    progress.totalPercent.value = 80
    progress.currentNodePercent.value = 40

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

  it('assigns preview urls for running jobs when previews enabled', async () => {
    useQueueStore().runningTasks = [
      createTask({
        jobId: 'live-preview',
        job: { priority: 1 },
        mockState: 'running'
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
        jobId: 'disabled-preview',
        job: { priority: 1 },
        mockState: 'running'
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

    Object.assign(useExecutionStore(), {
      executingNode: { title: '  Visible Node  ' }
    })
    await flush()
    expect(instance.currentNodeName.value).toBe('Visible Node')

    Object.assign(useExecutionStore(), {
      executingNode: {
        title: '   ',
        type: 'My Node Type'
      }
    })
    await flush()
    expect(instance.currentNodeName.value).toBe(
      'i18n(My Node Type.display_name)'
    )
  })

  it('groups terminal jobs without an execution end timestamp by create time', async () => {
    useQueueStore().historyTasks = [
      createTask({
        jobId: 'failed-before-execution',
        job: { priority: 1 },
        mockState: 'failed',
        createTime: Date.now()
      }),
      createTask({
        jobId: 'completed-without-end-time',
        job: { priority: 1 },
        mockState: 'completed',
        createTime: Date.now() - 1_000
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
        jobId: 'today-small',
        job: { priority: 4 },
        mockState: 'completed',
        executionEndTimestamp: Date.now(),
        executionTime: 2_000
      }),
      createTask({
        jobId: 'today-large',
        job: { priority: 3 },
        mockState: 'completed',
        executionEndTimestamp: Date.now(),
        executionTime: 5_000
      }),
      createTask({
        jobId: 'yesterday',
        job: { priority: 2 },
        mockState: 'failed',
        executionEndTimestamp: Date.now() - 86_400_000,
        executionTime: 1_000
      }),
      createTask({
        jobId: 'undated',
        job: { priority: 1 },
        mockState: 'pending'
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
