/* eslint-disable testing-library/prefer-user-event */
import { fireEvent, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import JobGroupsList from '@/components/queue/job/JobGroupsList.vue'
import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'
import type { TaskItemImpl } from '@/stores/queueStore'

const QueueJobItemStub = defineComponent({
  name: 'QueueJobItemStub',
  props: {
    jobId: { type: String, required: true },
    workflowId: { type: String, default: undefined },
    state: { type: String, required: true },
    title: { type: String, required: true },
    rightText: { type: String, default: '' },
    iconName: { type: String, default: undefined },
    iconImageUrl: { type: String, default: undefined },
    showClear: { type: Boolean, default: undefined },
    showMenu: { type: Boolean, default: undefined },
    progressTotalPercent: { type: Number, default: undefined },
    progressCurrentPercent: { type: Number, default: undefined },
    runningNodeName: { type: String, default: undefined },
    activeDetailsId: { type: String, default: null }
  },
  template: `
    <div class="queue-job-item-stub" :data-job-id="jobId" :data-active-details-id="activeDetailsId">
      <div :data-testid="'enter-' + jobId" @click="$emit('details-enter', jobId)" />
      <div :data-testid="'leave-' + jobId" @click="$emit('details-leave', jobId)" />
    </div>
  `
})

const createJobItem = (overrides: Partial<JobListItem> = {}): JobListItem => {
  const { taskRef, ...rest } = overrides
  return {
    id: 'job-id',
    title: 'Example job',
    meta: 'Meta text',
    state: 'running',
    iconName: 'icon',
    iconImageUrl: 'https://example.com/icon.png',
    showClear: true,
    taskRef: (taskRef ?? {
      workflow: { id: 'workflow-id' }
    }) as TaskItemImpl,
    progressTotalPercent: 60,
    progressCurrentPercent: 30,
    runningNodeName: 'Node A',
    ...rest
  }
}

function getActiveDetailsId(container: Element, jobId: string): string | null {
  return (
    container
      .querySelector(`[data-job-id="${jobId}"]`)
      ?.getAttribute('data-active-details-id') ?? null
  )
}

const renderComponent = (groups: JobGroup[]) =>
  render(JobGroupsList, {
    props: { displayedJobGroups: groups },
    global: {
      stubs: {
        QueueJobItem: QueueJobItemStub
      }
    }
  })

describe('JobGroupsList hover behavior', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays showing and hiding details while hovering over job rows', async () => {
    vi.useFakeTimers()
    const job = createJobItem({ id: 'job-d' })
    const { container } = renderComponent([
      { key: 'today', label: 'Today', items: [job] }
    ])

    await fireEvent.click(screen.getByTestId('enter-job-d'))
    vi.advanceTimersByTime(199)
    await nextTick()
    expect(getActiveDetailsId(container, 'job-d')).toBeNull()

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(getActiveDetailsId(container, 'job-d')).toBe(job.id)

    await fireEvent.click(screen.getByTestId('leave-job-d'))
    vi.advanceTimersByTime(149)
    await nextTick()
    expect(getActiveDetailsId(container, 'job-d')).toBe(job.id)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(getActiveDetailsId(container, 'job-d')).toBeNull()
  })

  it('clears the previous popover when hovering a new row briefly and leaving', async () => {
    vi.useFakeTimers()
    const firstJob = createJobItem({ id: 'job-1', title: 'First job' })
    const secondJob = createJobItem({ id: 'job-2', title: 'Second job' })
    const { container } = renderComponent([
      { key: 'today', label: 'Today', items: [firstJob, secondJob] }
    ])

    await fireEvent.click(screen.getByTestId('enter-job-1'))
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(getActiveDetailsId(container, 'job-1')).toBe(firstJob.id)

    await fireEvent.click(screen.getByTestId('leave-job-1'))
    await fireEvent.click(screen.getByTestId('enter-job-2'))
    vi.advanceTimersByTime(100)
    await nextTick()
    await fireEvent.click(screen.getByTestId('leave-job-2'))

    vi.advanceTimersByTime(50)
    await nextTick()
    expect(getActiveDetailsId(container, 'job-1')).toBeNull()

    vi.advanceTimersByTime(50)
    await nextTick()
    expect(getActiveDetailsId(container, 'job-2')).toBeNull()
  })
})
