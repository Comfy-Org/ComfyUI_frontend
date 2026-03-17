import { mount } from '@vue/test-utils'
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
  template: '<div class="queue-job-item-stub"></div>'
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

const mountComponent = (groups: JobGroup[]) =>
  mount(JobGroupsList, {
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
    const wrapper = mountComponent([
      { key: 'today', label: 'Today', items: [job] }
    ])
    const jobItem = wrapper.findComponent(QueueJobItemStub)

    jobItem.vm.$emit('details-enter', job.id)
    vi.advanceTimersByTime(199)
    await nextTick()
    expect(
      wrapper.findComponent(QueueJobItemStub).props('activeDetailsId')
    ).toBeNull()

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(
      wrapper.findComponent(QueueJobItemStub).props('activeDetailsId')
    ).toBe(job.id)

    wrapper.findComponent(QueueJobItemStub).vm.$emit('details-leave', job.id)
    vi.advanceTimersByTime(149)
    await nextTick()
    expect(
      wrapper.findComponent(QueueJobItemStub).props('activeDetailsId')
    ).toBe(job.id)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(
      wrapper.findComponent(QueueJobItemStub).props('activeDetailsId')
    ).toBeNull()
  })

  it('clears the previous popover when hovering a new row briefly and leaving', async () => {
    vi.useFakeTimers()
    const firstJob = createJobItem({ id: 'job-1', title: 'First job' })
    const secondJob = createJobItem({ id: 'job-2', title: 'Second job' })
    const wrapper = mountComponent([
      { key: 'today', label: 'Today', items: [firstJob, secondJob] }
    ])
    const jobItems = wrapper.findAllComponents(QueueJobItemStub)

    jobItems[0].vm.$emit('details-enter', firstJob.id)
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(jobItems[0].props('activeDetailsId')).toBe(firstJob.id)

    jobItems[0].vm.$emit('details-leave', firstJob.id)
    jobItems[1].vm.$emit('details-enter', secondJob.id)
    vi.advanceTimersByTime(100)
    await nextTick()
    jobItems[1].vm.$emit('details-leave', secondJob.id)

    vi.advanceTimersByTime(50)
    await nextTick()
    expect(jobItems[0].props('activeDetailsId')).toBeNull()

    vi.advanceTimersByTime(50)
    await nextTick()
    expect(jobItems[1].props('activeDetailsId')).toBeNull()
  })
})
