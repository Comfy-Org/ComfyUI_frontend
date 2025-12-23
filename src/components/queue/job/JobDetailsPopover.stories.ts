import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { TaskStatus } from '@/schemas/apiSchema'
import { useExecutionStore } from '@/stores/executionStore'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'

import JobDetailsPopover from './JobDetailsPopover.vue'

const meta: Meta<typeof JobDetailsPopover> = {
  title: 'Queue/JobDetailsPopover',
  component: JobDetailsPopover,
  args: {
    workflowId: 'WF-1234'
  },
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark'
    }
  },
  globals: {
    theme: 'dark'
  }
}

export default meta
type Story = StoryObj<typeof meta>

function resetStores() {
  const queue = useQueueStore()
  const exec = useExecutionStore()

  queue.pendingTasks = []
  queue.runningTasks = []
  queue.historyTasks = []

  exec.setNodeProgressStatesByPrompt({})
}

function makePendingTask(
  id: string,
  index: number,
  createTimeMs?: number
): TaskItemImpl {
  const extraData = {
    client_id: 'c1',
    ...(typeof createTimeMs === 'number' ? { create_time: createTimeMs } : {})
  }
  return new TaskItemImpl('Pending', [index, id, {}, extraData, []])
}

function makeRunningTask(
  id: string,
  index: number,
  createTimeMs?: number
): TaskItemImpl {
  const extraData = {
    client_id: 'c1',
    ...(typeof createTimeMs === 'number' ? { create_time: createTimeMs } : {})
  }
  return new TaskItemImpl('Running', [index, id, {}, extraData, []])
}

function makeRunningTaskWithStart(
  id: string,
  index: number,
  startedSecondsAgo: number
): TaskItemImpl {
  const start = Date.now() - startedSecondsAgo * 1000
  const status: TaskStatus = {
    status_str: 'success',
    completed: false,
    messages: [['execution_start', { prompt_id: id, timestamp: start } as any]]
  }
  return new TaskItemImpl(
    'Running',
    [index, id, {}, { client_id: 'c1', create_time: start - 5000 }, []],
    status
  )
}

function makeHistoryTask(
  id: string,
  index: number,
  durationSec: number,
  ok: boolean,
  errorMessage?: string
): TaskItemImpl {
  const start = Date.now() - durationSec * 1000 - 1000
  const end = start + durationSec * 1000
  const messages: TaskStatus['messages'] = ok
    ? [
        ['execution_start', { prompt_id: id, timestamp: start } as any],
        ['execution_success', { prompt_id: id, timestamp: end } as any]
      ]
    : [
        ['execution_start', { prompt_id: id, timestamp: start } as any],
        [
          'execution_error',
          {
            prompt_id: id,
            timestamp: end,
            node_id: '1',
            node_type: 'Node',
            executed: [],
            exception_message:
              errorMessage || 'Demo error: Node failed during execution',
            exception_type: 'RuntimeError',
            traceback: [],
            current_inputs: {},
            current_outputs: {}
          } as any
        ]
      ]
  const status: TaskStatus = {
    status_str: ok ? 'success' : 'error',
    completed: true,
    messages
  }
  return new TaskItemImpl(
    'History',
    [index, id, {}, { client_id: 'c1', create_time: start }, []],
    status
  )
}

export const Queued: Story = {
  render: (args) => ({
    components: { JobDetailsPopover },
    setup() {
      resetStores()
      const queue = useQueueStore()
      const exec = useExecutionStore()

      const jobId = 'job-queued-1'
      const queueIndex = 104

      // Current job in pending
      queue.pendingTasks = [
        makePendingTask(jobId, queueIndex, Date.now() - 90_000)
      ]
      // Add some other pending jobs to give context
      queue.pendingTasks.push(makePendingTask('job-older-1', 100))
      queue.pendingTasks.push(makePendingTask('job-older-2', 101))

      // Queued at (in metadata on prompt[4])

      // One running workflow
      exec.setNodeProgressStatesByPrompt({
        p1: {
          '1': {
            value: 1,
            max: 1,
            state: 'running',
            node_id: '1',
            prompt_id: 'p1'
          }
        }
      } as any)

      return { args: { ...args, jobId } }
    },
    template: `
      <div style="padding: 12px; background: var(--color-charcoal-700); display:inline-block;">
        <JobDetailsPopover v-bind="args" />
      </div>
    `
  })
}

export const QueuedParallel: Story = {
  render: (args) => ({
    components: { JobDetailsPopover },
    setup() {
      resetStores()
      const queue = useQueueStore()
      const exec = useExecutionStore()

      const jobId = 'job-queued-parallel'
      const queueIndex = 210

      // Current job in pending with some ahead
      queue.pendingTasks = [
        makePendingTask('job-ahead-1', 200, Date.now() - 180_000),
        makePendingTask('job-ahead-2', 205, Date.now() - 150_000),
        makePendingTask(jobId, queueIndex, Date.now() - 120_000)
      ]

      // Seen 2 minutes ago - set via prompt metadata above

      // History durations for ETA (in seconds)
      queue.historyTasks = [
        makeHistoryTask('hist-1', 150, 25, true),
        makeHistoryTask('hist-2', 151, 40, true),
        makeHistoryTask('hist-3', 152, 60, true)
      ]

      // Two parallel workflows running
      exec.setNodeProgressStatesByPrompt({
        p1: {
          '1': {
            value: 1,
            max: 2,
            state: 'running',
            node_id: '1',
            prompt_id: 'p1'
          }
        },
        p2: {
          '2': {
            value: 1,
            max: 2,
            state: 'running',
            node_id: '2',
            prompt_id: 'p2'
          }
        }
      } as any)

      return { args: { ...args, jobId } }
    },
    template: `
      <div style="padding: 12px; background: var(--color-charcoal-700); display:inline-block;">
        <JobDetailsPopover v-bind="args" />
      </div>
    `
  })
}

export const Running: Story = {
  render: (args) => ({
    components: { JobDetailsPopover },
    setup() {
      resetStores()
      const queue = useQueueStore()
      const exec = useExecutionStore()

      const jobId = 'job-running-1'
      const queueIndex = 300
      queue.runningTasks = [
        makeRunningTask(jobId, queueIndex, Date.now() - 65_000)
      ]
      queue.historyTasks = [
        makeHistoryTask('hist-r1', 250, 30, true),
        makeHistoryTask('hist-r2', 251, 45, true),
        makeHistoryTask('hist-r3', 252, 60, true)
      ]

      exec.setNodeProgressStatesByPrompt({
        p1: {
          '1': {
            value: 5,
            max: 10,
            state: 'running',
            node_id: '1',
            prompt_id: 'p1'
          }
        }
      } as any)

      return { args: { ...args, jobId } }
    },
    template: `
      <div style="padding: 12px; background: var(--color-charcoal-700); display:inline-block;">
        <JobDetailsPopover v-bind="args" />
      </div>
    `
  })
}

export const QueuedZeroAheadSingleRunning: Story = {
  render: (args) => ({
    components: { JobDetailsPopover },
    setup() {
      resetStores()
      const queue = useQueueStore()
      const exec = useExecutionStore()

      const jobId = 'job-queued-zero-ahead-single'
      const queueIndex = 510

      queue.pendingTasks = [
        makePendingTask(jobId, queueIndex, Date.now() - 45_000)
      ]

      queue.historyTasks = [
        makeHistoryTask('hist-s1', 480, 30, true),
        makeHistoryTask('hist-s2', 481, 50, true),
        makeHistoryTask('hist-s3', 482, 80, true)
      ]

      queue.runningTasks = [makeRunningTaskWithStart('running-1', 505, 20)]

      exec.setNodeProgressStatesByPrompt({
        p1: {
          '1': {
            value: 1,
            max: 3,
            state: 'running',
            node_id: '1',
            prompt_id: 'p1'
          }
        }
      } as any)

      return { args: { ...args, jobId } }
    },
    template: `
      <div style="padding: 12px; background: var(--color-charcoal-700); display:inline-block;">
        <JobDetailsPopover v-bind="args" />
      </div>
    `
  })
}

export const QueuedZeroAheadMultiRunning: Story = {
  render: (args) => ({
    components: { JobDetailsPopover },
    setup() {
      resetStores()
      const queue = useQueueStore()
      const exec = useExecutionStore()

      const jobId = 'job-queued-zero-ahead-multi'
      const queueIndex = 520

      queue.pendingTasks = [
        makePendingTask(jobId, queueIndex, Date.now() - 20_000)
      ]

      queue.historyTasks = [
        makeHistoryTask('hist-m1', 490, 40, true),
        makeHistoryTask('hist-m2', 491, 55, true),
        makeHistoryTask('hist-m3', 492, 70, true)
      ]

      queue.runningTasks = [
        makeRunningTaskWithStart('running-a', 506, 35),
        makeRunningTaskWithStart('running-b', 507, 10)
      ]

      exec.setNodeProgressStatesByPrompt({
        p1: {
          '1': {
            value: 2,
            max: 5,
            state: 'running',
            node_id: '1',
            prompt_id: 'p1'
          }
        },
        p2: {
          '2': {
            value: 3,
            max: 5,
            state: 'running',
            node_id: '2',
            prompt_id: 'p2'
          }
        }
      } as any)

      return { args: { ...args, jobId } }
    },
    template: `
      <div style="padding: 12px; background: var(--color-charcoal-700); display:inline-block;">
        <JobDetailsPopover v-bind="args" />
      </div>
    `
  })
}

export const Completed: Story = {
  render: (args) => ({
    components: { JobDetailsPopover },
    setup() {
      resetStores()
      const queue = useQueueStore()

      const jobId = 'job-completed-1'
      const queueIndex = 400
      queue.historyTasks = [makeHistoryTask(jobId, queueIndex, 37, true)]

      return { args: { ...args, jobId } }
    },
    template: `
      <div style="padding: 12px; background: var(--color-charcoal-700); display:inline-block;">
        <JobDetailsPopover v-bind="args" />
      </div>
    `
  })
}

export const Failed: Story = {
  render: (args) => ({
    components: { JobDetailsPopover },
    setup() {
      resetStores()
      const queue = useQueueStore()

      const jobId = 'job-failed-1'
      const queueIndex = 410
      queue.historyTasks = [
        makeHistoryTask(
          jobId,
          queueIndex,
          12,
          false,
          'Example error: invalid inputs for node X'
        )
      ]
      // Show a queued-at time for the failed job via history extra_data (2 minutes ago)
      // Already set by makeHistoryTask using its start timestamp

      return { args: { ...args, jobId } }
    },
    template: `
      <div style="padding: 12px; background: var(--color-charcoal-700); display:inline-block;">
        <JobDetailsPopover v-bind="args" />
      </div>
    `
  })
}
