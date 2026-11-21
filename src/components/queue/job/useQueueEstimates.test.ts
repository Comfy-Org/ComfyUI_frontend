import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { TaskItemImpl } from '@/stores/queueStore'
import type { JobState } from '@/types/queue'

import { formatElapsedTime, useQueueEstimates } from './useQueueEstimates'
import type { UseQueueEstimatesOptions } from './useQueueEstimates'

vi.mock(import('@/scripts/api'))

type QueueStore = UseQueueEstimatesOptions['queueStore']
type ExecutionStore = UseQueueEstimatesOptions['executionStore']

const makeHistoryTask = (
  executionTimeInSeconds: number | string | undefined
): TaskItemImpl =>
  ({
    executionTimeInSeconds
  }) as TaskItemImpl

const makeRunningTask = (executionStartTimestamp?: number): TaskItemImpl =>
  ({
    executionStartTimestamp
  }) as TaskItemImpl

const createQueueStore = (data?: Partial<QueueStore>): QueueStore =>
  ({
    historyTasks: [],
    runningTasks: [],
    ...data
  }) as QueueStore

const createExecutionStore = (data?: Partial<ExecutionStore>): ExecutionStore =>
  ({
    runningWorkflowCount: 1,
    ...data
  }) as ExecutionStore

function createWorkflowTask(
  workflowId: string | undefined,
  durationSeconds?: number,
  start = 1000
): TaskItemImpl {
  return new TaskItemImpl({
    id: workflowId ?? 'legacy-job',
    workflow_id: workflowId,
    status: durationSeconds === undefined ? 'in_progress' : 'completed',
    create_time: start,
    update_time: start,
    last_state_update: start,
    priority: 0,
    execution_start_time: start,
    execution_end_time:
      durationSeconds === undefined ? undefined : start + durationSeconds * 1000
  })
}

type HarnessOptions = {
  queueStore?: QueueStore
  executionStore?: ExecutionStore
  task?: TaskItemImpl | null
  jobState?: JobState | null
  firstSeenTs?: number
  jobsAhead?: number | null
  now?: number
}

const createHarness = (options?: HarnessOptions) => {
  const queueStore = options?.queueStore ?? createQueueStore()
  const executionStore = options?.executionStore ?? createExecutionStore()
  const taskRef = ref<TaskItemImpl | null>(options?.task ?? null)
  const jobStateRef = ref<JobState | null>(options?.jobState ?? null)
  const firstSeenRef = ref<number | undefined>(options?.firstSeenTs)
  const jobsAheadRef = ref<number | null>(options?.jobsAhead ?? null)
  const nowRef = ref(options?.now ?? 0)

  const result = useQueueEstimates({
    queueStore,
    executionStore,
    taskForJob: computed(() => taskRef.value),
    jobState: computed(() => jobStateRef.value),
    firstSeenTs: computed(() => firstSeenRef.value),
    jobsAhead: computed(() => jobsAheadRef.value),
    nowTs: nowRef
  })

  return {
    ...result,
    queueStore,
    executionStore,
    taskRef,
    jobStateRef,
    firstSeenRef,
    jobsAheadRef,
    nowRef
  }
}

describe('formatElapsedTime', () => {
  it('formats elapsed milliseconds and clamps negatives to zero', () => {
    expect(formatElapsedTime(0)).toBe('0m 0s')
    expect(formatElapsedTime(61000)).toBe('1m 1s')
    expect(formatElapsedTime(90000)).toBe('1m 30s')
    expect(formatElapsedTime(-5000)).toBe('0m 0s')
  })
})

describe('useQueueEstimates', () => {
  it('estimates a running job from its own workflow history and reacts to a different job', () => {
    const queueStore = createQueueStore({
      historyTasks: [
        createWorkflowTask('video', 100),
        createWorkflowTask('video', 120),
        createWorkflowTask('image', 10),
        createWorkflowTask('image', 20)
      ]
    })
    const harness = createHarness({
      queueStore,
      task: createWorkflowTask('video'),
      jobState: 'running',
      now: 31000
    })

    expect(harness.estimateRemainingRangeSeconds.value).toEqual([80, 90])

    harness.taskRef.value = createWorkflowTask('image', undefined, 27000)

    expect(harness.estimateRemainingRangeSeconds.value).toEqual([11, 16])
  })

  it.for([
    { name: 'no workflow ID', workflowId: undefined },
    { name: 'no matching history', workflowId: 'new-workflow' },
    { name: 'no usable matching durations', workflowId: 'incomplete-workflow' }
  ])('uses global history with $name', ({ workflowId }) => {
    const { estimateRemainingRangeSeconds } = createHarness({
      queueStore: createQueueStore({
        historyTasks: [
          createWorkflowTask('video', 100),
          createWorkflowTask('video', 120),
          createWorkflowTask('image', 10),
          createWorkflowTask('image', 20),
          new TaskItemImpl({
            ...createWorkflowTask('incomplete-workflow').job,
            status: 'failed'
          })
        ]
      }),
      task: createWorkflowTask(workflowId),
      jobState: 'running',
      now: 31000
    })

    expect(estimateRemainingRangeSeconds.value).toEqual([33, 90])
  })

  it('uses the last 20 matching durations even when other workflows fill recent history', () => {
    const { estimateRemainingRangeSeconds } = createHarness({
      queueStore: createQueueStore({
        historyTasks: [
          ...Array.from({ length: 25 }, (_, index) =>
            createWorkflowTask('video', index + 101)
          ),
          ...Array.from({ length: 21 }, () => createWorkflowTask('image', 10))
        ]
      }),
      task: createWorkflowTask('video'),
      jobState: 'running',
      now: 31000
    })

    expect(estimateRemainingRangeSeconds.value).toEqual([86, 91])
  })

  it('estimates when a runner becomes free using each running workflow history', () => {
    const { estimateRangeSeconds } = createHarness({
      queueStore: createQueueStore({
        historyTasks: [
          createWorkflowTask('video', 100),
          createWorkflowTask('video', 120),
          createWorkflowTask('image', 10),
          createWorkflowTask('image', 20)
        ],
        runningTasks: [
          createWorkflowTask('video'),
          createWorkflowTask('image', undefined, 27000)
        ]
      }),
      task: createWorkflowTask('video'),
      jobState: 'pending',
      jobsAhead: 0,
      now: 31000
    })

    expect(estimateRangeSeconds.value).toEqual([11, 16])
  })

  it('keeps global history for queued batches containing unknown workflows', () => {
    const { estimateRangeSeconds } = createHarness({
      queueStore: createQueueStore({
        historyTasks: [
          createWorkflowTask('video', 100),
          createWorkflowTask('video', 120),
          createWorkflowTask('image', 10),
          createWorkflowTask('image', 20)
        ]
      }),
      executionStore: createExecutionStore({ runningWorkflowCount: 2 }),
      task: createWorkflowTask('video'),
      jobState: 'pending',
      jobsAhead: 5
    })

    expect(estimateRangeSeconds.value).toEqual([188, 360])
  })

  it('only shows parallel queued stats for pending jobs seen with multiple runners', () => {
    const ready = createHarness({
      executionStore: createExecutionStore({ runningWorkflowCount: 2 }),
      jobState: 'pending',
      firstSeenTs: 1000
    })
    expect(ready.showParallelQueuedStats.value).toBe(true)

    const missingTimestamp = createHarness({
      executionStore: createExecutionStore({ runningWorkflowCount: 2 }),
      jobState: 'pending'
    })
    expect(missingTimestamp.showParallelQueuedStats.value).toBe(false)

    const singleRunner = createHarness({
      executionStore: createExecutionStore({ runningWorkflowCount: 1 }),
      jobState: 'pending',
      firstSeenTs: 1000
    })
    expect(singleRunner.showParallelQueuedStats.value).toBe(false)

    const runningJob = createHarness({
      executionStore: createExecutionStore({ runningWorkflowCount: 3 }),
      jobState: 'running',
      firstSeenTs: 1000
    })
    expect(runningJob.showParallelQueuedStats.value).toBe(false)
  })

  it('uses the last 20 valid durations to estimate queued batches', () => {
    const durations = Array.from({ length: 25 }, (_, idx) => idx + 1)
    const queueStore = createQueueStore({
      historyTasks: [
        ...durations.slice(0, 5).map((value) => makeHistoryTask(value)),
        makeHistoryTask('not-a-number'),
        makeHistoryTask(undefined),
        ...durations.slice(5).map((value) => makeHistoryTask(value))
      ]
    })

    const { estimateRangeSeconds } = createHarness({
      queueStore,
      executionStore: createExecutionStore({ runningWorkflowCount: 2 }),
      jobsAhead: 5
    })

    expect(estimateRangeSeconds.value).toEqual([47, 63])
  })

  it('returns null for estimateRangeSeconds when no history or jobsAhead is unknown', () => {
    const emptyHistory = createHarness({
      queueStore: createQueueStore(),
      jobsAhead: 2
    })
    expect(emptyHistory.estimateRangeSeconds.value).toBeNull()

    const missingAhead = createHarness({
      queueStore: createQueueStore({
        historyTasks: [makeHistoryTask(10)]
      })
    })
    expect(missingAhead.estimateRangeSeconds.value).toBeNull()
  })

  it('falls back to the running remaining range when there are no jobs ahead', () => {
    const now = 20000
    const queueStore = createQueueStore({
      historyTasks: [10, 20, 30].map((value) => makeHistoryTask(value)),
      runningTasks: [
        makeRunningTask(now - 5000),
        makeRunningTask(now - 15000),
        makeRunningTask(undefined)
      ]
    })

    const { estimateRangeSeconds } = createHarness({
      queueStore,
      jobsAhead: 0,
      now
    })

    expect(estimateRangeSeconds.value).toEqual([5, 15])
  })

  it('subtracts elapsed time when estimating a running job', () => {
    const now = 25000
    const queueStore = createQueueStore({
      historyTasks: [10, 20, 30].map((value) => makeHistoryTask(value))
    })

    const { estimateRemainingRangeSeconds } = createHarness({
      queueStore,
      task: makeRunningTask(5000),
      jobState: 'running',
      firstSeenTs: 2000,
      now
    })

    expect(estimateRemainingRangeSeconds.value).toEqual([0, 10])
  })

  it('uses the first-seen timestamp for pending jobs and clamps negatives to zero', () => {
    const queueStore = createQueueStore({
      historyTasks: [10, 20, 30].map((value) => makeHistoryTask(value))
    })

    const harness = createHarness({
      queueStore,
      jobState: 'pending',
      firstSeenTs: 10000,
      now: 25000
    })

    expect(harness.estimateRemainingRangeSeconds.value).toEqual([5, 15])

    harness.firstSeenRef.value = 1000
    harness.nowRef.value = 70000

    expect(harness.estimateRemainingRangeSeconds.value).toEqual([0, 0])
  })

  it('computes the elapsed label using execution start, then first-seen timestamp', () => {
    const harness = createHarness()

    harness.taskRef.value = makeRunningTask(1000)
    harness.jobStateRef.value = 'running'
    harness.nowRef.value = 4000

    expect(harness.timeElapsedValue.value).toBe('0m 3s')

    harness.jobStateRef.value = 'pending'
    harness.firstSeenRef.value = 2000
    harness.nowRef.value = 5000

    expect(harness.timeElapsedValue.value).toBe('0m 3s')

    harness.taskRef.value = null
    harness.firstSeenRef.value = undefined

    expect(harness.timeElapsedValue.value).toBe('')
  })
})
