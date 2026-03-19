import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import JobHistorySidebarTab from './JobHistorySidebarTab.vue'

const JobDetailsPopoverStub = defineComponent({
  name: 'JobDetailsPopover',
  props: {
    jobId: { type: String, required: true },
    workflowId: { type: String, default: undefined }
  },
  template: '<div class="job-details-popover-stub" />'
})

vi.mock('@/composables/queue/useJobList', async () => {
  const { ref } = await import('vue')
  const jobHistoryItem = {
    id: 'job-1',
    title: 'Job 1',
    meta: 'meta',
    state: 'completed',
    taskRef: {
      workflowId: 'workflow-1',
      previewOutput: {
        isImage: true,
        isVideo: false,
        url: '/api/view/job-1.png'
      }
    }
  }

  return {
    useJobList: () => ({
      selectedJobTab: ref('All'),
      selectedWorkflowFilter: ref('all'),
      selectedSortMode: ref('mostRecent'),
      searchQuery: ref(''),
      hasFailedJobs: ref(false),
      filteredTasks: ref([]),
      groupedJobItems: ref([
        {
          key: 'group-1',
          label: 'Group 1',
          items: [jobHistoryItem]
        }
      ])
    })
  }
})

vi.mock('@/composables/queue/useJobMenu', () => ({
  useJobMenu: () => ({
    getJobMenuEntries: () => [],
    cancelJob: vi.fn()
  })
}))

vi.mock('@/composables/queue/useQueueClearHistoryDialog', () => ({
  useQueueClearHistoryDialog: () => ({
    showQueueClearHistoryDialog: vi.fn()
  })
}))

vi.mock('@/composables/queue/useResultGallery', async () => {
  const { ref } = await import('vue')
  return {
    useResultGallery: () => ({
      galleryActiveIndex: ref(-1),
      galleryItems: ref([]),
      onViewItem: vi.fn()
    })
  }
})

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync: <T extends (...args: never[]) => unknown>(
      fn: T
    ) => fn
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn()
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    showDialog: vi.fn()
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    clearInitializationByJobIds: vi.fn()
  })
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => ({
    runningTasks: [],
    pendingTasks: [],
    delete: vi.fn()
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const SidebarTabTemplateStub = {
  name: 'SidebarTabTemplate',
  props: ['title'],
  template:
    '<div><slot name="alt-title" /><slot name="header" /><slot name="body" /></div>'
}

function mountComponent() {
  return mount(JobHistorySidebarTab, {
    global: {
      plugins: [i18n],
      stubs: {
        SidebarTabTemplate: SidebarTabTemplateStub,
        JobFilterTabs: true,
        JobFilterActions: true,
        JobHistoryActionsMenu: true,
        ResultGallery: true,
        teleport: true,
        JobDetailsPopover: JobDetailsPopoverStub
      }
    }
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('JobHistorySidebarTab', () => {
  it('shows the job details popover for jobs in the history panel', async () => {
    vi.useFakeTimers()
    const wrapper = mountComponent()
    const jobRow = wrapper.find('[data-job-id="job-1"]')

    await jobRow.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    const popover = wrapper.findComponent(JobDetailsPopoverStub)
    expect(popover.exists()).toBe(true)
    expect(popover.props()).toMatchObject({
      jobId: 'job-1',
      workflowId: 'workflow-1'
    })
  })
})
