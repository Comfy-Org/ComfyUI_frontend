import { scheduler } from 'node:timers/promises'
import { getActivePinia } from 'pinia'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, toValue } from 'vue'

import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'
import type { JobListItem as JobListViewItem } from '@/composables/queue/useJobList'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { i18n } from '@/i18n'
import { useAssetSelectionStore } from '@/platform/assets/composables/useAssetSelectionStore'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { JobDetail, JobStatus } from '@comfyorg/api-client/jobTypes'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false
}))

vi.mock(import('@/composables/useFeatureFlags'))

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

function renderComponent(
  runningTasks: TaskItemImpl[],
  pendingTasks: TaskItemImpl[],
  mountAssetsSidebar = false
) {
  const pinia = getActivePinia()!
  const queueStore = useQueueStore(pinia)
  const assetSelectionStore = useAssetSelectionStore(pinia)
  const sidebarTabStore = useSidebarTabStore(pinia)
  queueStore.runningTasks = runningTasks
  queueStore.pendingTasks = pendingTasks

  const user = userEvent.setup()

  const Host = defineComponent({
    setup() {
      return () => [
        h(QueueProgressOverlay, { expanded: true }),
        mountAssetsSidebar && sidebarTabStore.activeSidebarTabId === 'assets'
          ? h(AssetsSidebarTab)
          : null
      ]
    }
  })

  render(Host, {
    global: {
      plugins: [pinia, i18n],
      stubs: {
        QueueOverlayExpanded: QueueOverlayExpandedStub,
        QueueOverlayActive: true,
        MediaLightbox: true,
        SidebarTabTemplate: defineComponent({
          setup(_, { slots }) {
            return () => h('section', slots.body?.())
          }
        }),
        AssetsSidebarGridView: true,
        AssetsSidebarListView: true,
        MediaAssetFilterBar: true,
        MediaAssetSelectionBar: true,
        Menu: true
      }
    }
  })

  return { assetSelectionStore, sidebarTabStore, user }
}

function createOutputAsset(id: string, jobId: string): AssetItem {
  return {
    id,
    name: `${id}.png`,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    tags: ['output'],
    user_metadata: { jobId, nodeId: '1', subfolder: '' }
  }
}

function createInspectableItem(
  jobId: string,
  outputsCount = 1
): JobListViewItem & { taskRef: TaskItemImpl } {
  return {
    id: jobId,
    title: jobId,
    meta: '',
    state: 'completed',
    taskRef: new TaskItemImpl({
      id: jobId,
      status: 'completed',
      create_time: 0,
      priority: 0,
      outputs_count: outputsCount,
      preview_output: {
        filename: `${jobId}.png`,
        subfolder: '',
        type: 'output',
        nodeId: '1',
        mediaType: 'images'
      }
    })
  }
}

function outputPage(assets: AssetItem[]) {
  return Response.json({ assets, total: assets.length, has_more: false })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill
  })
  return { promise, resolve }
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

  it('keeps the inspected cached asset selected after opening and refreshing the sidebar', async () => {
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    const target = createOutputAsset('cached-asset', 'cached-job')
    const replacement = deferred<Response>()
    const refreshStarted = deferred<void>()
    vi.spyOn(api, 'fetchApi').mockImplementation(async (route) => {
      if (route.includes('input')) return outputPage([])
      return outputPage([target])
    })
    const assetsStore = useAssetsStore()
    await waitFor(() =>
      expect(toValue(assetsStore.outputAssets.items)).toEqual([target])
    )
    vi.spyOn(api, 'fetchApi').mockImplementation(async (route) => {
      if (route.includes('input')) return outputPage([])
      refreshStarted.resolve()
      return replacement.promise
    })
    itemToView = createInspectableItem('cached-job')
    const { assetSelectionStore, sidebarTabStore, user } = renderComponent(
      [],
      [],
      true
    )
    assetSelectionStore.setSource('input')

    await user.click(screen.getByTestId('view-item-button'))
    await refreshStarted.promise
    expect(sidebarTabStore.activeSidebarTabId).toBe('assets')
    replacement.resolve(outputPage([target]))

    await waitFor(() =>
      expect({
        source: assetSelectionStore.activeSource,
        selected: assetSelectionStore.selectedIdsArray
      }).toEqual({ source: 'output', selected: ['cached-asset'] })
    )
  })

  it('does not let an older output lookup replace the newer inspected selection', async () => {
    const older = createOutputAsset('older-asset', 'older-lookup-job')
    const newer = createOutputAsset('newer-asset', 'newer-lookup-job')
    const olderLookup = deferred<AssetItem | undefined>()
    const lookupStarted = deferred<void>()
    const assetsStore = useAssetsStore()
    vi.spyOn(assetsStore, 'loadOutputAssetByJobId')
      .mockImplementationOnce(() => {
        lookupStarted.resolve()
        return olderLookup.promise
      })
      .mockResolvedValueOnce(newer)
    itemToView = createInspectableItem('older-lookup-job')
    const { assetSelectionStore, user } = renderComponent([], [])

    await user.click(screen.getByTestId('view-item-button'))
    await lookupStarted.promise
    itemToView = createInspectableItem('newer-lookup-job')
    await user.click(screen.getByTestId('view-item-button'))
    await waitFor(() =>
      expect(assetSelectionStore.selectedIdsArray).toEqual(['newer-asset'])
    )
    olderLookup.resolve(older)
    await scheduler.yield()

    expect(assetSelectionStore.selectedIdsArray).toEqual(['newer-asset'])
  })

  it('does not let an older gallery request replace the newer inspected selection', async () => {
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    const older = createOutputAsset('older-asset', 'older-gallery-job')
    const newer = createOutputAsset('newer-asset', 'newer-gallery-job')
    vi.spyOn(api, 'fetchApi').mockImplementation(async (route) =>
      outputPage(route.includes('input') ? [] : [older, newer])
    )
    const oldDetail = deferred<JobDetail>()
    const oldRequestStarted = deferred<void>()
    vi.spyOn(api, 'getJobDetail').mockImplementation(async () => {
      oldRequestStarted.resolve()
      return oldDetail.promise
    })
    const oldItem = createInspectableItem('older-gallery-job', 2)
    const newItem = createInspectableItem('newer-gallery-job')
    const queueStore = useQueueStore()
    queueStore.historyTasks = [oldItem.taskRef, newItem.taskRef]
    itemToView = oldItem
    const { assetSelectionStore, user } = renderComponent([], [], true)

    await user.click(screen.getByTestId('view-item-button'))
    await oldRequestStarted.promise
    itemToView = newItem
    await user.click(screen.getByTestId('view-item-button'))
    await waitFor(() =>
      expect(assetSelectionStore.selectedIdsArray).toEqual(['newer-asset'])
    )
    oldDetail.resolve({
      id: 'older-gallery-job',
      status: 'completed',
      create_time: 0,
      priority: 0,
      outputs: {
        '1': {
          images: [
            { filename: 'older.png', subfolder: '', type: 'output' },
            { filename: 'older-2.png', subfolder: '', type: 'output' }
          ]
        }
      }
    })
    await scheduler.yield()
    expect(assetSelectionStore.selectedIdsArray).toEqual(['newer-asset'])
  })
})
