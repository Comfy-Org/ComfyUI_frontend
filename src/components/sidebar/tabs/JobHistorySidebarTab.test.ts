import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'

import JobHistorySidebarTab from './JobHistorySidebarTab.vue'

const testState = vi.hoisted(() => ({
  groupedJobItems: [] as Array<{
    key: string
    label: string
    items: JobListItem[]
  }>,
  filteredTasks: [] as JobListItem[],
  getJobMenuEntries: vi.fn(() => []),
  cancelJob: vi.fn(),
  openResultGallery: vi.fn(),
  showQueueClearHistoryDialog: vi.fn(),
  commandExecute: vi.fn(),
  showDialog: vi.fn(),
  clearInitializationByJobIds: vi.fn(),
  queueDelete: vi.fn()
}))

const JobAssetsListStub = defineComponent({
  name: 'JobAssetsList',
  props: {
    displayedJobGroups: {
      type: Array,
      required: true
    },
    getMenuEntries: {
      type: Function,
      required: true
    }
  },
  template: '<div class="job-assets-list-stub" />'
})

vi.mock('@/composables/queue/useJobList', () => ({
  useJobList: () => ({
    selectedJobTab: ref('All'),
    selectedWorkflowFilter: ref('all'),
    selectedSortMode: ref('mostRecent'),
    searchQuery: ref(''),
    hasFailedJobs: ref(false),
    filteredTasks: computed(() => testState.filteredTasks),
    groupedJobItems: computed(() => testState.groupedJobItems)
  })
}))

vi.mock('@/composables/queue/useJobMenu', () => ({
  useJobMenu: () => ({
    getJobMenuEntries: testState.getJobMenuEntries,
    cancelJob: testState.cancelJob
  })
}))

vi.mock('@/composables/queue/useQueueClearHistoryDialog', () => ({
  useQueueClearHistoryDialog: () => ({
    showQueueClearHistoryDialog: testState.showQueueClearHistoryDialog
  })
}))

vi.mock('@/composables/queue/useResultGallery', () => ({
  useResultGallery: () => ({
    galleryActiveIndex: ref(-1),
    galleryItems: ref([]),
    onViewItem: testState.openResultGallery
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync: <T extends (...args: never[]) => unknown>(
      fn: T
    ) => fn
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: testState.commandExecute
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    showDialog: testState.showDialog
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    clearInitializationByJobIds: testState.clearInitializationByJobIds
  })
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => ({
    runningTasks: [],
    pendingTasks: [],
    delete: testState.queueDelete
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const buildJob = (overrides: Partial<JobListItem> = {}): JobListItem =>
  ({
    id: 'job-1',
    title: 'Job 1',
    meta: 'meta',
    state: 'completed',
    taskRef: {
      workflowId: 'workflow-1',
      previewOutput: {
        isImage: true,
        isVideo: false,
        is3D: false,
        url: '/api/view/job-1.png'
      }
    },
    ...overrides
  }) as JobListItem

const setDisplayedJobs = (items: JobListItem[]) => {
  testState.filteredTasks = items
  testState.groupedJobItems = [
    {
      key: 'group-1',
      label: 'Group 1',
      items
    }
  ]
}

function mountComponent() {
  return mount(JobHistorySidebarTab, {
    global: {
      plugins: [i18n],
      stubs: {
        SidebarTabTemplate: {
          name: 'SidebarTabTemplate',
          template:
            '<div><slot name="alt-title" /><slot name="header" /><slot name="body" /></div>'
        },
        JobFilterTabs: true,
        JobFilterActions: true,
        JobHistoryActionsMenu: true,
        MediaLightbox: true,
        JobAssetsList: JobAssetsListStub,
        teleport: true
      }
    }
  })
}

describe('JobHistorySidebarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDisplayedJobs([buildJob()])
  })

  it('passes grouped jobs and menu getter to JobAssetsList', () => {
    const wrapper = mountComponent()
    const jobAssetsList = wrapper.findComponent(JobAssetsListStub)

    expect(jobAssetsList.props('displayedJobGroups')).toEqual(
      testState.groupedJobItems
    )
    expect(jobAssetsList.props('getMenuEntries')).toBe(
      testState.getJobMenuEntries
    )
  })

  it('forwards regular view-item events to the result gallery', async () => {
    const job = buildJob()
    setDisplayedJobs([job])
    const wrapper = mountComponent()

    wrapper.findComponent(JobAssetsListStub).vm.$emit('view-item', job)

    expect(testState.openResultGallery).toHaveBeenCalledWith(job)
    expect(testState.showDialog).not.toHaveBeenCalled()
  })

  it('opens the 3D viewer dialog for 3D view-item events', async () => {
    const job = buildJob({
      taskRef: {
        workflowId: 'workflow-1',
        previewOutput: {
          isImage: false,
          isVideo: false,
          is3D: true,
          url: '/api/view/job-1.glb'
        }
      } as JobListItem['taskRef']
    })
    setDisplayedJobs([job])
    const wrapper = mountComponent()

    wrapper.findComponent(JobAssetsListStub).vm.$emit('view-item', job)

    expect(testState.showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'asset-3d-viewer',
        title: job.title,
        props: { modelUrl: '/api/view/job-1.glb' }
      })
    )
    expect(testState.openResultGallery).not.toHaveBeenCalled()
  })

  it('forwards cancel-item events to useJobMenu.cancelJob', async () => {
    const job = buildJob({ state: 'running' })
    setDisplayedJobs([job])
    const wrapper = mountComponent()

    wrapper.findComponent(JobAssetsListStub).vm.$emit('cancel-item', job)

    expect(testState.cancelJob).toHaveBeenCalledWith(job)
  })

  it('forwards delete-item events to queueStore.delete', async () => {
    const job = buildJob()
    const taskRef = job.taskRef
    const wrapper = mountComponent()

    wrapper.findComponent(JobAssetsListStub).vm.$emit('delete-item', job)

    expect(testState.queueDelete).toHaveBeenCalledWith(taskRef)
  })

  it('runs menu actions emitted by JobAssetsList', async () => {
    const onClick = vi.fn()
    const wrapper = mountComponent()

    wrapper
      .findComponent(JobAssetsListStub)
      .vm.$emit('menu-action', { key: 'test', label: 'Test', onClick })

    expect(onClick).toHaveBeenCalled()
  })
})
