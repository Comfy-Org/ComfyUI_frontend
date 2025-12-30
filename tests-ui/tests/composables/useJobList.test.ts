import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'

import { useJobList } from '@/composables/queue/useJobList'
import type { JobState } from '@/types/queue'
import type { BuildJobDisplayCtx, JobDisplay } from '@/utils/queueDisplay'
import type { TaskItemImpl } from '@/stores/queueStore'

type TestTask = {
  promptId: string
  queueIndex: number
  mockState: JobState
  executionTime?: number
  executionEndTimestamp?: number
  createTime?: number
  workflow?: { id?: string }
}

const translations: Record<string, string> = {
  'queue.jobList.undated': 'Undated',
  'g.emDash': '--',
  'g.untitled': 'Untitled'
}
let localeRef: Ref<string>
let tMock: ReturnType<typeof vi.fn>
const ensureLocaleMocks = () => {
  if (!localeRef) {
    localeRef = ref('en-US') as Ref<string>
  }
  if (!tMock) {
    tMock = vi.fn((key: string) => translations[key] ?? key)
  }
  return { localeRef, tMock }
}

vi.mock('vue-i18n', () => ({
  useI18n: () => {
    ensureLocaleMocks()
    return {
      t: tMock,
      locale: localeRef
    }
  }
}))

let stMock: (key: string, fallback?: string) => string
const ensureStMock = () => {
  if (!stMock) {
    stMock = vi.fn(
      (key: string, fallback?: string) => `i18n(${key})-${fallback}`
    )
  }
  return stMock
}
vi.mock('@/i18n', () => ({
  st: ensureStMock()
}))

let totalPercent: Ref<number>
let currentNodePercent: Ref<number>
const ensureProgressRefs = () => {
  if (!totalPercent) totalPercent = ref(0) as Ref<number>
  if (!currentNodePercent) currentNodePercent = ref(0) as Ref<number>
  return { totalPercent, currentNodePercent }
}
vi.mock('@/composables/queue/useQueueProgress', () => ({
  useQueueProgress: () => {
    ensureProgressRefs()
    return {
      totalPercent,
      currentNodePercent
    }
  }
}))

let buildJobDisplayMock: (
  task: TaskItemImpl,
  state: JobState,
  ctx: BuildJobDisplayCtx
) => JobDisplay
const ensureBuildDisplayMock = () => {
  if (!buildJobDisplayMock) {
    buildJobDisplayMock = vi.fn((task: any, state: JobState, options: any) => ({
      primary: `Job ${task.promptId}`,
      secondary: `${state} meta`,
      iconName: `${state}-icon`,
      iconImageUrl: undefined,
      showClear: state === 'failed',
      options
    }))
  }
  return buildJobDisplayMock
}
vi.mock('@/utils/queueDisplay', () => ({
  buildJobDisplay: ensureBuildDisplayMock()
}))

let jobStateFromTaskMock: ReturnType<typeof vi.fn>
const ensureJobStateMock = () => {
  if (!jobStateFromTaskMock) {
    jobStateFromTaskMock = vi.fn(
      (task: TestTask, isInitializing?: boolean): JobState =>
        task.mockState ?? (isInitializing ? 'running' : 'completed')
    )
  }
  return jobStateFromTaskMock
}
vi.mock('@/utils/queueUtil', () => ({
  jobStateFromTask: ensureJobStateMock()
}))

let queueStoreMock: {
  pendingTasks: TestTask[]
  runningTasks: TestTask[]
  historyTasks: TestTask[]
}
const ensureQueueStore = () => {
  if (!queueStoreMock) {
    queueStoreMock = reactive({
      pendingTasks: [] as TestTask[],
      runningTasks: [] as TestTask[],
      historyTasks: [] as TestTask[]
    })
  }
  return queueStoreMock
}
vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => {
    return ensureQueueStore()
  }
}))

let executionStoreMock: {
  activePromptId: string | null
  executingNode: null | { title?: string; type?: string }
  isPromptInitializing: (promptId?: string | number) => boolean
}
let isPromptInitializingMock: (promptId?: string | number) => boolean
const ensureExecutionStore = () => {
  if (!isPromptInitializingMock) {
    isPromptInitializingMock = vi.fn(() => false)
  }
  if (!executionStoreMock) {
    executionStoreMock = reactive({
      activePromptId: null as string | null,
      executingNode: null as null | { title?: string; type?: string },
      isPromptInitializing: (promptId?: string | number) =>
        isPromptInitializingMock(promptId)
    })
  }
  return executionStoreMock
}
vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => {
    return ensureExecutionStore()
  }
}))

let workflowStoreMock: {
  activeWorkflow: null | { activeState?: { id?: string } }
}
const ensureWorkflowStore = () => {
  if (!workflowStoreMock) {
    workflowStoreMock = reactive({
      activeWorkflow: null as null | { activeState?: { id?: string } }
    })
  }
  return workflowStoreMock
}
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => {
    return ensureWorkflowStore()
  }
}))

const createTask = (
  overrides: Partial<TestTask> & { mockState?: JobState } = {}
): TestTask => ({
  promptId:
    overrides.promptId ?? `task-${Math.random().toString(36).slice(2, 7)}`,
  queueIndex: overrides.queueIndex ?? 0,
  mockState: overrides.mockState ?? 'pending',
  executionTime: overrides.executionTime,
  executionEndTimestamp: overrides.executionEndTimestamp,
  createTime: overrides.createTime,
  workflow: overrides.workflow
})

const mountUseJobList = () => {
  let composable: ReturnType<typeof useJobList>
  const wrapper = mount({
    template: '<div />',
    setup() {
      composable = useJobList()
      return {}
    }
  })
  return { wrapper, composable: composable! }
}

const resetStores = () => {
  const queueStore = ensureQueueStore()
  queueStore.pendingTasks = []
  queueStore.runningTasks = []
  queueStore.historyTasks = []

  const executionStore = ensureExecutionStore()
  executionStore.activePromptId = null
  executionStore.executingNode = null

  const workflowStore = ensureWorkflowStore()
  workflowStore.activeWorkflow = null

  ensureProgressRefs()
  totalPercent.value = 0
  currentNodePercent.value = 0

  ensureLocaleMocks()
  localeRef.value = 'en-US'
  tMock.mockClear()

  if (stMock) vi.mocked(stMock).mockClear()
  if (buildJobDisplayMock) vi.mocked(buildJobDisplayMock).mockClear()
  if (jobStateFromTaskMock) vi.mocked(jobStateFromTaskMock).mockClear()

  if (isPromptInitializingMock) {
    vi.mocked(isPromptInitializingMock).mockReset()
    vi.mocked(isPromptInitializingMock).mockReturnValue(false)
  }
}

const flush = async () => {
  await nextTick()
}

describe('useJobList', () => {
  let wrapper: ReturnType<typeof mount> | null = null
  let api: ReturnType<typeof useJobList> | null = null

  beforeEach(() => {
    resetStores()
    wrapper?.unmount()
    wrapper = null
    api = null
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    api = null
    vi.useRealTimers()
  })

  const initComposable = () => {
    const mounted = mountUseJobList()
    wrapper = mounted.wrapper
    api = mounted.composable
    return api!
  }

  it('tracks recently added pending jobs and clears the hint after expiry', async () => {
    vi.useFakeTimers()
    queueStoreMock.pendingTasks = [
      createTask({ promptId: '1', queueIndex: 1, mockState: 'pending' })
    ]

    const { jobItems } = initComposable()
    await flush()

    jobItems.value
    expect(buildJobDisplayMock).toHaveBeenCalledWith(
      expect.anything(),
      'pending',
      expect.objectContaining({ showAddedHint: true })
    )

    vi.mocked(buildJobDisplayMock).mockClear()
    await vi.advanceTimersByTimeAsync(3000)
    await flush()

    jobItems.value
    expect(buildJobDisplayMock).toHaveBeenCalledWith(
      expect.anything(),
      'pending',
      expect.objectContaining({ showAddedHint: false })
    )
  })

  it('removes pending hint immediately when the task leaves the queue', async () => {
    vi.useFakeTimers()
    const taskId = '2'
    queueStoreMock.pendingTasks = [
      createTask({ promptId: taskId, queueIndex: 1, mockState: 'pending' })
    ]

    const { jobItems } = initComposable()
    await flush()
    jobItems.value

    queueStoreMock.pendingTasks = []
    await flush()
    expect(vi.getTimerCount()).toBe(0)

    vi.mocked(buildJobDisplayMock).mockClear()
    queueStoreMock.pendingTasks = [
      createTask({ promptId: taskId, queueIndex: 2, mockState: 'pending' })
    ]
    await flush()
    jobItems.value
    expect(buildJobDisplayMock).toHaveBeenCalledWith(
      expect.anything(),
      'pending',
      expect.objectContaining({ showAddedHint: true })
    )
  })

  it('cleans up timeouts on unmount', async () => {
    vi.useFakeTimers()
    queueStoreMock.pendingTasks = [
      createTask({ promptId: '3', queueIndex: 1, mockState: 'pending' })
    ]

    initComposable()
    await flush()
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    wrapper?.unmount()
    wrapper = null
    await flush()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sorts all tasks by queue index descending', async () => {
    queueStoreMock.pendingTasks = [
      createTask({ promptId: 'p', queueIndex: 1, mockState: 'pending' })
    ]
    queueStoreMock.runningTasks = [
      createTask({ promptId: 'r', queueIndex: 5, mockState: 'running' })
    ]
    queueStoreMock.historyTasks = [
      createTask({ promptId: 'h', queueIndex: 3, mockState: 'completed' })
    ]

    const { allTasksSorted } = initComposable()
    await flush()

    expect(allTasksSorted.value.map((task) => task.promptId)).toEqual([
      'r',
      'h',
      'p'
    ])
  })

  it('filters by job tab and resets failed tab when failures disappear', async () => {
    queueStoreMock.historyTasks = [
      createTask({ promptId: 'c', queueIndex: 3, mockState: 'completed' }),
      createTask({ promptId: 'f', queueIndex: 2, mockState: 'failed' }),
      createTask({ promptId: 'p', queueIndex: 1, mockState: 'pending' })
    ]

    const instance = initComposable()
    await flush()

    instance.selectedJobTab.value = 'Completed'
    await flush()
    expect(instance.filteredTasks.value.map((t) => t.promptId)).toEqual(['c'])

    instance.selectedJobTab.value = 'Failed'
    await flush()
    expect(instance.filteredTasks.value.map((t) => t.promptId)).toEqual(['f'])
    expect(instance.hasFailedJobs.value).toBe(true)

    queueStoreMock.historyTasks = [
      createTask({ promptId: 'c', queueIndex: 3, mockState: 'completed' })
    ]
    await flush()

    expect(instance.hasFailedJobs.value).toBe(false)
    expect(instance.selectedJobTab.value).toBe('All')
  })

  it('filters by active workflow when requested', async () => {
    queueStoreMock.pendingTasks = [
      createTask({
        promptId: 'wf-1',
        queueIndex: 2,
        mockState: 'pending',
        workflow: { id: 'workflow-1' }
      }),
      createTask({
        promptId: 'wf-2',
        queueIndex: 1,
        mockState: 'pending',
        workflow: { id: 'workflow-2' }
      })
    ]

    const instance = initComposable()
    await flush()

    instance.selectedWorkflowFilter.value = 'current'
    await flush()
    expect(instance.filteredTasks.value).toEqual([])

    workflowStoreMock.activeWorkflow = { activeState: { id: 'workflow-1' } }
    await flush()

    expect(instance.filteredTasks.value.map((t) => t.promptId)).toEqual([
      'wf-1'
    ])
  })

  it('hydrates job items with active progress and compute hours', async () => {
    queueStoreMock.runningTasks = [
      createTask({
        promptId: 'active',
        queueIndex: 3,
        mockState: 'running',
        executionTime: 7_200_000
      }),
      createTask({
        promptId: 'other',
        queueIndex: 2,
        mockState: 'running',
        executionTime: 3_600_000
      })
    ]

    executionStoreMock.activePromptId = 'active'
    executionStoreMock.executingNode = { title: 'Render Node' }
    totalPercent.value = 80
    currentNodePercent.value = 40

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

  it('derives current node name from execution store fallbacks', async () => {
    const instance = initComposable()
    await flush()

    expect(instance.currentNodeName.value).toBe('--')

    executionStoreMock.executingNode = { title: '  Visible Node  ' }
    await flush()
    expect(instance.currentNodeName.value).toBe('Visible Node')

    executionStoreMock.executingNode = {
      title: '   ',
      type: 'My Node Type'
    }
    await flush()
    expect(instance.currentNodeName.value).toBe(
      'i18n(nodeDefs.My Node Type.display_name)-My Node Type'
    )
  })

  it('groups job items by date label and sorts by total generation time when requested', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-10T12:00:00Z'))
    queueStoreMock.historyTasks = [
      createTask({
        promptId: 'today-small',
        queueIndex: 4,
        mockState: 'completed',
        executionEndTimestamp: Date.now(),
        executionTime: 2_000
      }),
      createTask({
        promptId: 'today-large',
        queueIndex: 3,
        mockState: 'completed',
        executionEndTimestamp: Date.now(),
        executionTime: 5_000
      }),
      createTask({
        promptId: 'yesterday',
        queueIndex: 2,
        mockState: 'failed',
        executionEndTimestamp: Date.now() - 86_400_000,
        executionTime: 1_000
      }),
      createTask({
        promptId: 'undated',
        queueIndex: 1,
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
