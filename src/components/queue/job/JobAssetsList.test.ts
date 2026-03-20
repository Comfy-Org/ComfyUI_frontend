import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'

import JobAssetsList from './JobAssetsList.vue'

vi.mock('@/components/queue/job/JobDetailsPopover.vue', () => ({
  default: {
    name: 'JobDetailsPopover',
    template: '<div class="job-details-popover-stub" />'
  }
}))

const JobDetailsPopoverStub = defineComponent({
  name: 'JobDetailsPopover',
  props: {
    jobId: { type: String, required: true },
    workflowId: { type: String, default: undefined }
  },
  template: '<div class="job-details-popover-stub" />'
})

vi.mock('vue-i18n', () => {
  return {
    createI18n: () => ({
      global: {
        t: (key: string) => key,
        te: () => true,
        d: (value: string) => value
      }
    }),
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

const createPreviewOutput = (
  filename: string,
  mediaType: string = 'images'
): NonNullable<NonNullable<JobListItem['taskRef']>['previewOutput']> =>
  ({
    filename,
    mediaType,
    isImage: mediaType === 'images',
    isVideo: mediaType === 'video',
    isAudio: mediaType === 'audio',
    is3D: mediaType === 'model',
    url: `/api/view/${filename}`
  }) as NonNullable<NonNullable<JobListItem['taskRef']>['previewOutput']>

const createTaskRef = (
  preview?: NonNullable<NonNullable<JobListItem['taskRef']>['previewOutput']>
): JobListItem['taskRef'] =>
  ({
    workflowId: 'workflow-1',
    previewOutput: preview
  }) as JobListItem['taskRef']

const buildJob = (overrides: Partial<JobListItem> = {}): JobListItem => ({
  id: 'job-1',
  title: 'Job 1',
  meta: 'meta',
  state: 'completed',
  taskRef: createTaskRef(createPreviewOutput('job-1.png')),
  ...overrides
})

const mountJobAssetsList = (jobs: JobListItem[]) => {
  const displayedJobGroups: JobGroup[] = [
    {
      key: 'group-1',
      label: 'Group 1',
      items: jobs
    }
  ]

  return mount(JobAssetsList, {
    props: {
      displayedJobGroups,
      getMenuEntries: () => []
    },
    global: {
      stubs: {
        teleport: true,
        JobDetailsPopover: JobDetailsPopoverStub
      }
    }
  })
}

function createDomRect({
  top,
  left,
  width,
  height
}: {
  top: number
  left: number
  width: number
  height: number
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ''
  } as DOMRect
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('JobAssetsList', () => {
  it('emits viewItem on preview-click for completed jobs with preview', async () => {
    const job = buildJob()
    const wrapper = mountJobAssetsList([job])

    const listItem = wrapper.findComponent({ name: 'AssetsListItem' })
    listItem.vm.$emit('preview-click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('viewItem')).toEqual([[job]])
  })

  it('emits viewItem on double-click for completed jobs with preview', async () => {
    const job = buildJob()
    const wrapper = mountJobAssetsList([job])

    const listItem = wrapper.findComponent({ name: 'AssetsListItem' })
    await listItem.trigger('dblclick')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('viewItem')).toEqual([[job]])
  })

  it('emits viewItem on double-click for completed video jobs without icon image', async () => {
    const job = buildJob({
      iconImageUrl: undefined,
      taskRef: createTaskRef(createPreviewOutput('job-1.webm', 'video'))
    })
    const wrapper = mountJobAssetsList([job])

    const listItem = wrapper.findComponent({ name: 'AssetsListItem' })
    expect(listItem.props('previewUrl')).toBe('/api/view/job-1.webm')
    expect(listItem.props('isVideoPreview')).toBe(true)

    await listItem.trigger('dblclick')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('viewItem')).toEqual([[job]])
  })

  it('emits viewItem on icon click for completed 3D jobs without preview tile', async () => {
    const job = buildJob({
      iconImageUrl: undefined,
      taskRef: createTaskRef(createPreviewOutput('job-1.glb', 'model'))
    })
    const wrapper = mountJobAssetsList([job])

    const listItem = wrapper.findComponent({ name: 'AssetsListItem' })

    await listItem.find('i').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('viewItem')).toEqual([[job]])
  })

  it('does not emit viewItem on double-click for non-completed jobs', async () => {
    const job = buildJob({
      state: 'running',
      taskRef: createTaskRef(createPreviewOutput('job-1.png'))
    })
    const wrapper = mountJobAssetsList([job])

    const listItem = wrapper.findComponent({ name: 'AssetsListItem' })
    await listItem.trigger('dblclick')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('viewItem')).toBeUndefined()
  })

  it('emits viewItem from the View button for completed jobs without preview output', async () => {
    const job = buildJob({
      iconImageUrl: undefined,
      taskRef: createTaskRef()
    })
    const wrapper = mountJobAssetsList([job])
    const jobRow = wrapper.find(`[data-job-id="${job.id}"]`)

    await jobRow.trigger('mouseenter')
    const viewButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'menuLabels.View')
    expect(viewButton).toBeDefined()

    await viewButton!.trigger('click')
    await nextTick()

    expect(wrapper.emitted('viewItem')).toEqual([[job]])
  })

  it('shows and hides the job details popover with hover delays', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const wrapper = mountJobAssetsList([job])
    const jobRow = wrapper.find(`[data-job-id="${job.id}"]`)

    await jobRow.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(199)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await nextTick()

    const popover = wrapper.findComponent(JobDetailsPopoverStub)
    expect(popover.exists()).toBe(true)
    expect(popover.props()).toMatchObject({
      jobId: job.id,
      workflowId: 'workflow-1'
    })

    await jobRow.trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(149)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).exists()).toBe(false)
  })

  it('keeps the job details popover open while hovering the popover', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const wrapper = mountJobAssetsList([job])
    const jobRow = wrapper.find(`[data-job-id="${job.id}"]`)

    await jobRow.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    await jobRow.trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()

    const popover = wrapper.find('.job-details-popover')
    expect(popover.exists()).toBe(true)

    await popover.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).exists()).toBe(true)

    await popover.trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(149)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).exists()).toBe(false)
  })

  it('positions the popover to the right of rows near the left viewport edge', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const wrapper = mountJobAssetsList([job])
    const jobRow = wrapper.find(`[data-job-id="${job.id}"]`)

    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280)
    vi.spyOn(jobRow.element, 'getBoundingClientRect').mockReturnValue(
      createDomRect({
        top: 100,
        left: 40,
        width: 200,
        height: 48
      })
    )

    await jobRow.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    const popover = wrapper.find('.job-details-popover')
    expect(popover.attributes('style')).toContain('left: 248px;')
  })

  it('positions the popover to the left of rows near the right viewport edge', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const wrapper = mountJobAssetsList([job])
    const jobRow = wrapper.find(`[data-job-id="${job.id}"]`)

    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280)
    vi.spyOn(jobRow.element, 'getBoundingClientRect').mockReturnValue(
      createDomRect({
        top: 100,
        left: 980,
        width: 200,
        height: 48
      })
    )

    await jobRow.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    const popover = wrapper.find('.job-details-popover')
    expect(popover.attributes('style')).toContain('left: 672px;')
  })
  it('clears the previous popover when hovering a new row briefly and leaving the list', async () => {
    vi.useFakeTimers()
    const firstJob = buildJob({ id: 'job-1' })
    const secondJob = buildJob({ id: 'job-2', title: 'Job 2' })
    const wrapper = mountJobAssetsList([firstJob, secondJob])
    const firstRow = wrapper.find('[data-job-id="job-1"]')
    const secondRow = wrapper.find('[data-job-id="job-2"]')

    await firstRow.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).props('jobId')).toBe(
      'job-1'
    )

    await firstRow.trigger('mouseleave')
    await secondRow.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    await secondRow.trigger('mouseleave')

    await vi.advanceTimersByTimeAsync(150)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).exists()).toBe(false)
  })

  it('shows the new popover after the previous row hides while the next row stays hovered', async () => {
    vi.useFakeTimers()
    const firstJob = buildJob({ id: 'job-1' })
    const secondJob = buildJob({ id: 'job-2', title: 'Job 2' })
    const wrapper = mountJobAssetsList([firstJob, secondJob])
    const firstRow = wrapper.find('[data-job-id="job-1"]')
    const secondRow = wrapper.find('[data-job-id="job-2"]')

    await firstRow.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).props('jobId')).toBe(
      'job-1'
    )

    await firstRow.trigger('mouseleave')
    await secondRow.trigger('mouseenter')

    await vi.advanceTimersByTimeAsync(150)
    await nextTick()
    expect(wrapper.findComponent(JobDetailsPopoverStub).exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(50)
    await nextTick()

    const popover = wrapper.findComponent(JobDetailsPopoverStub)
    expect(popover.exists()).toBe(true)
    expect(popover.props('jobId')).toBe('job-2')
  })

  it('does not show details if the hovered row disappears before the show delay ends', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const wrapper = mountJobAssetsList([job])
    const jobRow = wrapper.find(`[data-job-id="${job.id}"]`)

    await jobRow.trigger('mouseenter')
    await wrapper.setProps({ displayedJobGroups: [] })
    await nextTick()

    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    expect(wrapper.findComponent(JobDetailsPopoverStub).exists()).toBe(false)
    expect(wrapper.find('.job-details-popover').exists()).toBe(false)
  })
})
