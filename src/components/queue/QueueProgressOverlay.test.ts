import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import type { JobListItem as JobListViewItem } from '@/composables/queue/useJobList'
import { i18n } from '@/i18n'
import { useAssetSelectionStore } from '@/platform/assets/composables/useAssetSelectionStore'
import type { JobStatus } from '@/platform/remote/comfyui/jobs/jobTypes'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

const { loadOutputAssetMock } = vi.hoisted(() => ({
  loadOutputAssetMock: vi.fn<(assetId: string) => Promise<boolean>>()
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({ loadOutputAsset: loadOutputAssetMock })
}))

let itemToView: JobListViewItem | undefined

const QueueOverlayExpandedStub = defineComponent({
  name: 'QueueOverlayExpanded',
  props: {
    headerTitle: {
      type: String,
      required: true
    }
  },
  emits: ['viewItem'],
  setup(_, { emit }) {
    return {
      viewItem: () => itemToView && emit('viewItem', itemToView)
    }
  },
  template: `
    <div>
      <div data-testid="expanded-title">{{ headerTitle }}</div>
      <button data-testid="show-assets-button" @click="$emit('show-assets')" />
      <button data-testid="view-item-button" @click="viewItem" />
    </div>
  `
})

function createTask(id: string, status: JobStatus): TaskItemImpl {
  return new TaskItemImpl({
    id,
    status,
    create_time: 0,
    priority: 0
  })
}

function createCompletedJobView(id: string): JobListViewItem {
  const task = new TaskItemImpl({
    id,
    status: 'completed',
    create_time: 0,
    priority: 0,
    preview_output: {
      filename: `${id}.png`,
      mediaType: 'images',
      nodeId: '1',
      subfolder: '',
      type: 'output'
    }
  })
  return {
    id,
    meta: '',
    showClear: false,
    state: 'completed',
    taskRef: task,
    title: id
  }
}

function renderComponent(
  runningTasks: TaskItemImpl[],
  pendingTasks: TaskItemImpl[]
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false
  })
  const queueStore = useQueueStore(pinia)
  const assetSelectionStore = useAssetSelectionStore(pinia)
  const sidebarTabStore = useSidebarTabStore(pinia)
  queueStore.runningTasks = runningTasks
  queueStore.pendingTasks = pendingTasks

  const user = userEvent.setup()

  render(QueueProgressOverlay, {
    props: {
      expanded: true
    },
    global: {
      plugins: [pinia, i18n],
      stubs: {
        QueueOverlayExpanded: QueueOverlayExpandedStub,
        QueueOverlayActive: true,
        MediaLightbox: true
      },
      directives: {
        tooltip: () => {}
      }
    }
  })

  return { assetSelectionStore, sidebarTabStore, user }
}

describe('QueueProgressOverlay', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    itemToView = undefined
  })

  it('shows expanded header with running and queued labels', () => {
    renderComponent(
      [
        createTask('running-1', 'in_progress'),
        createTask('running-2', 'in_progress')
      ],
      [createTask('pending-1', 'pending')]
    )

    expect(screen.getByTestId('expanded-title')).toHaveTextContent(
      '2 running, 1 queued'
    )
  })

  it('shows only running label when queued count is zero', () => {
    renderComponent([createTask('running-1', 'in_progress')], [])

    expect(screen.getByTestId('expanded-title')).toHaveTextContent('1 running')
  })

  it('shows job queue title when there are no active jobs', () => {
    renderComponent([], [])

    expect(screen.getByTestId('expanded-title')).toHaveTextContent('Job Queue')
  })

  it('toggles the assets sidebar tab when show-assets is clicked', async () => {
    const { sidebarTabStore, user } = renderComponent([], [])

    expect(sidebarTabStore.activeSidebarTabId).toBe(null)

    await user.click(screen.getByTestId('show-assets-button'))
    expect(sidebarTabStore.activeSidebarTabId).toBe('assets')

    await user.click(screen.getByTestId('show-assets-button'))
    expect(sidebarTabStore.activeSidebarTabId).toBe(null)
  })

  it('loads older pages before selecting a job asset', async () => {
    itemToView = createCompletedJobView('target-job')
    loadOutputAssetMock.mockResolvedValue(true)
    const { assetSelectionStore, sidebarTabStore, user } = renderComponent(
      [],
      []
    )

    await user.click(screen.getByTestId('view-item-button'))

    await waitFor(() =>
      expect(assetSelectionStore.selectedIdsArray).toEqual(['target-job'])
    )
    expect(loadOutputAssetMock).toHaveBeenCalledWith('target-job')
    expect(sidebarTabStore.activeSidebarTabId).toBe('assets')
  })

  it('does not select a missing job asset when pagination cannot advance', async () => {
    itemToView = createCompletedJobView('missing-job')
    loadOutputAssetMock.mockResolvedValue(false)
    const { assetSelectionStore, sidebarTabStore, user } = renderComponent(
      [],
      []
    )

    await user.click(screen.getByTestId('view-item-button'))

    await waitFor(() =>
      expect(loadOutputAssetMock).toHaveBeenCalledWith('missing-job')
    )
    expect(assetSelectionStore.selectedIdsArray).toEqual([])
    expect(sidebarTabStore.activeSidebarTabId).toBe('assets')
  })

  it('keeps the latest asset selection when an older request finishes last', async () => {
    let resolveFirst!: (found: boolean) => void
    const firstLoad = new Promise<boolean>((resolve) => {
      resolveFirst = resolve
    })
    loadOutputAssetMock
      .mockImplementationOnce(() => firstLoad)
      .mockResolvedValueOnce(true)
    itemToView = createCompletedJobView('older-request')
    const { assetSelectionStore, user } = renderComponent([], [])

    await user.click(screen.getByTestId('view-item-button'))
    await waitFor(() =>
      expect(loadOutputAssetMock).toHaveBeenCalledWith('older-request')
    )

    itemToView = createCompletedJobView('latest-request')
    await user.click(screen.getByTestId('view-item-button'))
    await waitFor(() =>
      expect(assetSelectionStore.selectedIdsArray).toEqual(['latest-request'])
    )

    resolveFirst(true)
    await firstLoad
    await Promise.resolve()

    expect(assetSelectionStore.selectedIdsArray).toEqual(['latest-request'])
  })

  it('keeps the latest sidebar focus after switching tabs during an older request', async () => {
    let resolveFirst!: (found: boolean) => void
    const firstLoad = new Promise<boolean>((resolve) => {
      resolveFirst = resolve
    })
    loadOutputAssetMock
      .mockImplementationOnce(() => firstLoad)
      .mockResolvedValueOnce(true)
    itemToView = createCompletedJobView('older-request')
    const { assetSelectionStore, sidebarTabStore, user } = renderComponent(
      [],
      []
    )

    await user.click(screen.getByTestId('view-item-button'))
    await waitFor(() =>
      expect(loadOutputAssetMock).toHaveBeenCalledWith('older-request')
    )

    sidebarTabStore.activeSidebarTabId = 'queue'
    itemToView = createCompletedJobView('latest-request')
    await user.click(screen.getByTestId('view-item-button'))
    await waitFor(() =>
      expect(assetSelectionStore.selectedIdsArray).toEqual(['latest-request'])
    )
    expect(sidebarTabStore.activeSidebarTabId).toBe('assets')

    sidebarTabStore.activeSidebarTabId = 'queue'
    resolveFirst(true)
    await firstLoad
    await Promise.resolve()

    expect(sidebarTabStore.activeSidebarTabId).toBe('queue')
    expect(assetSelectionStore.selectedIdsArray).toEqual(['latest-request'])
  })
})
