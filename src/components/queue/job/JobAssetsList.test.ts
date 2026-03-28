/* eslint-disable testing-library/no-container, testing-library/no-node-access -- stubs lack ARIA roles; data attributes for props */
/* eslint-disable testing-library/prefer-user-event -- fireEvent needed: fake timers require fireEvent for mouseEnter/mouseLeave */
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import './testUtils/mockTanstackVirtualizer'
import { JobDetailsPopoverStub } from './testUtils/mockJobDetailsPopover'

import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'

import JobAssetsList from './JobAssetsList.vue'

const AssetsListItemStub = defineComponent({
  name: 'AssetsListItem',
  props: {
    previewUrl: { type: String, default: undefined },
    isVideoPreview: { type: Boolean, default: false },
    previewAlt: { type: String, default: '' },
    iconName: { type: String, default: undefined },
    iconClass: { type: String, default: undefined },
    primaryText: { type: String, default: undefined },
    secondaryText: { type: String, default: undefined },
    progressTotalPercent: { type: Number, default: undefined },
    progressCurrentPercent: { type: Number, default: undefined }
  },
  setup(_, { emit }) {
    return { emitPreviewClick: () => emit('preview-click') }
  },
  template: `
    <div class="assets-list-item-stub"
         :data-preview-url="previewUrl"
         :data-is-video="isVideoPreview">
      <span>{{ primaryText }}</span>
      <button data-testid="preview-trigger" @click="emitPreviewClick" />
      <i v-if="iconName && !previewUrl" :class="iconName" @click="emitPreviewClick" />
      <slot name="actions" />
    </div>
  `
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

type TestPreviewOutput = {
  url: string
  isImage: boolean
  isVideo: boolean
}

type TestTaskRef = {
  workflowId?: string
  previewOutput?: TestPreviewOutput
}

type TestJobListItem = Omit<JobListItem, 'taskRef'> & {
  taskRef?: TestTaskRef
}

type TestJobGroup = Omit<JobGroup, 'items'> & {
  items: TestJobListItem[]
}

const createPreviewOutput = (
  filename: string,
  mediaType: string = 'images'
): TestPreviewOutput => {
  const url = `/api/view/${filename}`
  return {
    url,
    isImage: mediaType === 'images',
    isVideo: mediaType === 'video'
  }
}

const createTaskRef = (preview?: TestPreviewOutput): TestTaskRef => ({
  workflowId: 'workflow-1',
  ...(preview && { previewOutput: preview })
})

const buildJob = (
  overrides: Partial<TestJobListItem> = {}
): TestJobListItem => ({
  id: 'job-1',
  title: 'Job 1',
  meta: 'meta',
  state: 'completed',
  taskRef: createTaskRef(createPreviewOutput('job-1.png')),
  ...overrides
})

function renderJobAssetsList({
  jobs = [],
  displayedJobGroups,
  attrs,
  onViewItem
}: {
  jobs?: TestJobListItem[]
  displayedJobGroups?: TestJobGroup[]
  attrs?: Record<string, string>
  onViewItem?: (item: JobListItem) => void
} = {}) {
  const user = userEvent.setup()

  const result = render(JobAssetsList, {
    props: {
      displayedJobGroups: (displayedJobGroups ?? [
        {
          key: 'group-1',
          label: 'Group 1',
          items: jobs
        }
      ]) as JobGroup[],
      ...(onViewItem && { onViewItem })
    },
    attrs,
    global: {
      stubs: {
        teleport: true,
        JobDetailsPopover: JobDetailsPopoverStub,
        AssetsListItem: AssetsListItemStub
      }
    }
  })

  return { ...result, user }
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
  it('renders grouped headers alongside job rows', () => {
    const displayedJobGroups: TestJobGroup[] = [
      {
        key: 'today',
        label: 'Today',
        items: [buildJob({ id: 'job-1' })]
      },
      {
        key: 'yesterday',
        label: 'Yesterday',
        items: [buildJob({ id: 'job-2', title: 'Job 2' })]
      }
    ]

    const { container } = renderJobAssetsList({ displayedJobGroups })

    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('Yesterday')).toBeTruthy()
    expect(container.querySelector('[data-job-id="job-1"]')).not.toBeNull()
    expect(container.querySelector('[data-job-id="job-2"]')).not.toBeNull()
  })

  it('forwards parent attrs to the scroll container', () => {
    renderJobAssetsList({
      attrs: {
        class: 'min-h-0 flex-1'
      },
      displayedJobGroups: [
        {
          key: 'today',
          label: 'Today',
          items: [buildJob({ id: 'job-1' })]
        }
      ]
    })

    expect(screen.getByTestId('job-assets-list').className.split(' ')).toEqual(
      expect.arrayContaining(['min-h-0', 'flex-1', 'h-full', 'overflow-y-auto'])
    )
  })

  it('emits viewItem on preview-click for completed jobs with preview', async () => {
    const job = buildJob()
    const onViewItem = vi.fn()
    const { user } = renderJobAssetsList({ jobs: [job], onViewItem })

    await user.click(screen.getByTestId('preview-trigger'))

    expect(onViewItem).toHaveBeenCalledWith(job)
  })

  it('emits viewItem on double-click for completed jobs with preview', async () => {
    const job = buildJob()
    const onViewItem = vi.fn()
    const { container, user } = renderJobAssetsList({ jobs: [job], onViewItem })

    const stubRoot = container.querySelector('.assets-list-item-stub')!
    await user.dblClick(stubRoot)

    expect(onViewItem).toHaveBeenCalledWith(job)
  })

  it('emits viewItem on double-click for completed video jobs without icon image', async () => {
    const job = buildJob({
      iconImageUrl: undefined,
      taskRef: createTaskRef(createPreviewOutput('job-1.webm', 'video'))
    })
    const onViewItem = vi.fn()
    const { container, user } = renderJobAssetsList({ jobs: [job], onViewItem })

    const stubRoot = container.querySelector('.assets-list-item-stub')!
    expect(stubRoot.getAttribute('data-preview-url')).toBe(
      '/api/view/job-1.webm'
    )
    expect(stubRoot.getAttribute('data-is-video')).toBe('true')

    await user.dblClick(stubRoot)

    expect(onViewItem).toHaveBeenCalledWith(job)
  })

  it('emits viewItem on icon click for completed 3D jobs without preview tile', async () => {
    const job = buildJob({
      iconImageUrl: undefined,
      taskRef: createTaskRef(createPreviewOutput('job-1.glb', 'model'))
    })
    const onViewItem = vi.fn()
    const { container, user } = renderJobAssetsList({ jobs: [job], onViewItem })

    const icon = container.querySelector('.assets-list-item-stub i')!
    await user.click(icon)

    expect(onViewItem).toHaveBeenCalledWith(job)
  })

  it('does not emit viewItem on double-click for non-completed jobs', async () => {
    const job = buildJob({
      state: 'running',
      taskRef: createTaskRef(createPreviewOutput('job-1.png'))
    })
    const onViewItem = vi.fn()
    const { container, user } = renderJobAssetsList({ jobs: [job], onViewItem })

    const stubRoot = container.querySelector('.assets-list-item-stub')!
    await user.dblClick(stubRoot)

    expect(onViewItem).not.toHaveBeenCalled()
  })

  it('emits viewItem from the View button for completed jobs without preview output', async () => {
    const job = buildJob({
      iconImageUrl: undefined,
      taskRef: createTaskRef()
    })
    const onViewItem = vi.fn()
    const { container } = renderJobAssetsList({ jobs: [job], onViewItem })

    const jobRow = container.querySelector(`[data-job-id="${job.id}"]`)!
    await fireEvent.mouseEnter(jobRow)

    await fireEvent.click(screen.getByText('menuLabels.View'))
    await nextTick()

    expect(onViewItem).toHaveBeenCalledWith(job)
  })

  it('shows and hides the job details popover with hover delays', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const { container } = renderJobAssetsList({ jobs: [job] })

    const jobRow = container.querySelector(`[data-job-id="${job.id}"]`)!

    await fireEvent.mouseEnter(jobRow)
    await vi.advanceTimersByTimeAsync(199)
    await nextTick()
    expect(container.querySelector('.job-details-popover-stub')).toBeNull()

    await vi.advanceTimersByTimeAsync(1)
    await nextTick()

    const popoverStub = container.querySelector('.job-details-popover-stub')!
    expect(popoverStub).not.toBeNull()
    expect(popoverStub.getAttribute('data-job-id')).toBe(job.id)
    expect(popoverStub.getAttribute('data-workflow-id')).toBe('workflow-1')

    await fireEvent.mouseLeave(jobRow)
    await vi.advanceTimersByTimeAsync(149)
    await nextTick()
    expect(container.querySelector('.job-details-popover-stub')).not.toBeNull()

    await vi.advanceTimersByTimeAsync(1)
    await nextTick()
    expect(container.querySelector('.job-details-popover-stub')).toBeNull()
  })

  it('keeps the job details popover open while hovering the popover', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const { container } = renderJobAssetsList({ jobs: [job] })

    const jobRow = container.querySelector(`[data-job-id="${job.id}"]`)!

    await fireEvent.mouseEnter(jobRow)
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    await fireEvent.mouseLeave(jobRow)
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()

    const popoverWrapper = container.querySelector('.job-details-popover')!
    expect(popoverWrapper).not.toBeNull()

    await fireEvent.mouseEnter(popoverWrapper)
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    expect(container.querySelector('.job-details-popover-stub')).not.toBeNull()

    await fireEvent.mouseLeave(popoverWrapper)
    await vi.advanceTimersByTimeAsync(149)
    await nextTick()
    expect(container.querySelector('.job-details-popover-stub')).not.toBeNull()

    await vi.advanceTimersByTimeAsync(1)
    await nextTick()
    expect(container.querySelector('.job-details-popover-stub')).toBeNull()
  })

  it('positions the popover to the right of rows near the left viewport edge', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const { container } = renderJobAssetsList({ jobs: [job] })

    const jobRow = container.querySelector(`[data-job-id="${job.id}"]`)!

    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280)
    vi.spyOn(jobRow, 'getBoundingClientRect').mockReturnValue(
      createDomRect({
        top: 100,
        left: 40,
        width: 200,
        height: 48
      })
    )

    await fireEvent.mouseEnter(jobRow)
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    const popover = container.querySelector('.job-details-popover')!
    expect(popover.getAttribute('style')).toContain('left: 248px;')
  })

  it('positions the popover to the left of rows near the right viewport edge', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const { container } = renderJobAssetsList({ jobs: [job] })

    const jobRow = container.querySelector(`[data-job-id="${job.id}"]`)!

    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280)
    vi.spyOn(jobRow, 'getBoundingClientRect').mockReturnValue(
      createDomRect({
        top: 100,
        left: 980,
        width: 200,
        height: 48
      })
    )

    await fireEvent.mouseEnter(jobRow)
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    const popover = container.querySelector('.job-details-popover')!
    expect(popover.getAttribute('style')).toContain('left: 672px;')
  })

  it('clears the previous popover when hovering a new row briefly and leaving the list', async () => {
    vi.useFakeTimers()
    const firstJob = buildJob({ id: 'job-1' })
    const secondJob = buildJob({ id: 'job-2', title: 'Job 2' })
    const { container } = renderJobAssetsList({
      jobs: [firstJob, secondJob]
    })

    const firstRow = container.querySelector('[data-job-id="job-1"]')!
    const secondRow = container.querySelector('[data-job-id="job-2"]')!

    await fireEvent.mouseEnter(firstRow)
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()
    const popoverJobId = container
      .querySelector('.job-details-popover-stub')
      ?.getAttribute('data-job-id')
    expect(popoverJobId).toBe('job-1')

    await fireEvent.mouseLeave(firstRow)
    await fireEvent.mouseEnter(secondRow)
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    await fireEvent.mouseLeave(secondRow)

    await vi.advanceTimersByTimeAsync(150)
    await nextTick()
    expect(container.querySelector('.job-details-popover-stub')).toBeNull()
  })

  it('shows the new popover after the previous row hides while the next row stays hovered', async () => {
    vi.useFakeTimers()
    const firstJob = buildJob({ id: 'job-1' })
    const secondJob = buildJob({ id: 'job-2', title: 'Job 2' })
    const { container } = renderJobAssetsList({
      jobs: [firstJob, secondJob]
    })

    const firstRow = container.querySelector('[data-job-id="job-1"]')!
    const secondRow = container.querySelector('[data-job-id="job-2"]')!

    await fireEvent.mouseEnter(firstRow)
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()
    const firstPopoverJobId = container
      .querySelector('.job-details-popover-stub')
      ?.getAttribute('data-job-id')
    expect(firstPopoverJobId).toBe('job-1')

    await fireEvent.mouseLeave(firstRow)
    await fireEvent.mouseEnter(secondRow)

    await vi.advanceTimersByTimeAsync(150)
    await nextTick()
    expect(container.querySelector('.job-details-popover-stub')).toBeNull()

    await vi.advanceTimersByTimeAsync(50)
    await nextTick()

    const popoverStub = container.querySelector('.job-details-popover-stub')!
    expect(popoverStub).not.toBeNull()
    expect(popoverStub.getAttribute('data-job-id')).toBe('job-2')
  })

  it('does not show details if the hovered row disappears before the show delay ends', async () => {
    vi.useFakeTimers()
    const job = buildJob()
    const { container, rerender } = renderJobAssetsList({ jobs: [job] })

    const jobRow = container.querySelector(`[data-job-id="${job.id}"]`)!

    await fireEvent.mouseEnter(jobRow)
    await rerender({ displayedJobGroups: [] })
    await nextTick()

    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    expect(container.querySelector('.job-details-popover-stub')).toBeNull()
    expect(container.querySelector('.job-details-popover')).toBeNull()
  })
})
