import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { useAssetsSidebarBadgeStore } from '@/stores/workspace/assetsSidebarBadgeStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const createHistoryTask = ({
  id,
  outputsCount,
  hasPreview = true
}: {
  id: string
  outputsCount?: number
  hasPreview?: boolean
}) =>
  new TaskItemImpl({
    id,
    status: 'completed',
    create_time: Date.now(),
    priority: 1,
    outputs_count: outputsCount,
    preview_output: hasPreview
      ? {
          filename: `${id}.png`,
          subfolder: '',
          type: 'output',
          nodeId: '1',
          mediaType: 'images'
        }
      : undefined
  } as JobListItem)

describe('useAssetsSidebarBadgeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not count existing history items on initialization', async () => {
    const queueStore = useQueueStore()
    queueStore.historyTasks = [
      createHistoryTask({ id: 'job-1', outputsCount: 2 })
    ]

    const assetsSidebarBadgeStore = useAssetsSidebarBadgeStore()
    await nextTick()

    expect(assetsSidebarBadgeStore.unseenAddedAssetsCount).toBe(0)
  })

  it('counts new history items while assets tab is closed', async () => {
    const queueStore = useQueueStore()
    const assetsSidebarBadgeStore = useAssetsSidebarBadgeStore()

    queueStore.historyTasks = [
      createHistoryTask({ id: 'job-1', outputsCount: 2 })
    ]
    await nextTick()

    expect(assetsSidebarBadgeStore.unseenAddedAssetsCount).toBe(2)

    queueStore.historyTasks = [
      createHistoryTask({ id: 'job-2', hasPreview: true }),
      ...queueStore.historyTasks
    ]
    await nextTick()

    expect(assetsSidebarBadgeStore.unseenAddedAssetsCount).toBe(3)
  })

  it('clears and suppresses count while assets tab is open', async () => {
    const queueStore = useQueueStore()
    const sidebarTabStore = useSidebarTabStore()
    const assetsSidebarBadgeStore = useAssetsSidebarBadgeStore()

    queueStore.historyTasks = [
      createHistoryTask({ id: 'job-1', outputsCount: 2 })
    ]
    await nextTick()
    expect(assetsSidebarBadgeStore.unseenAddedAssetsCount).toBe(2)

    sidebarTabStore.activeSidebarTabId = 'assets'
    await nextTick()
    expect(assetsSidebarBadgeStore.unseenAddedAssetsCount).toBe(0)

    queueStore.historyTasks = [
      createHistoryTask({ id: 'job-2', outputsCount: 4 }),
      ...queueStore.historyTasks
    ]
    await nextTick()
    expect(assetsSidebarBadgeStore.unseenAddedAssetsCount).toBe(0)

    sidebarTabStore.activeSidebarTabId = 'node-library'
    await nextTick()

    queueStore.historyTasks = [
      createHistoryTask({ id: 'job-3', outputsCount: 1 }),
      ...queueStore.historyTasks
    ]
    await nextTick()
    expect(assetsSidebarBadgeStore.unseenAddedAssetsCount).toBe(1)
  })
})
