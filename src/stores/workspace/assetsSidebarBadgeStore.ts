import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import type { TaskItemImpl } from '@/stores/queueStore'
import { useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const getAddedAssetCount = (task: TaskItemImpl): number => {
  if (typeof task.outputsCount === 'number' && task.outputsCount > 0) {
    return task.outputsCount
  }

  return task.previewOutput ? 1 : 0
}

export const useAssetsSidebarBadgeStore = defineStore(
  'assetsSidebarBadge',
  () => {
    const queueStore = useQueueStore()
    const sidebarTabStore = useSidebarTabStore()

    const unseenAddedAssetsCount = ref(0)
    const seenHistoryJobIds = ref(new Set<string>())
    const hasInitializedHistory = ref(false)

    const markCurrentHistoryAsSeen = () => {
      seenHistoryJobIds.value = new Set(
        queueStore.historyTasks.map((task) => task.jobId)
      )
    }

    watch(
      () => queueStore.historyTasks,
      (historyTasks) => {
        if (!hasInitializedHistory.value) {
          hasInitializedHistory.value = true
          markCurrentHistoryAsSeen()
          return
        }

        const isAssetsTabOpen = sidebarTabStore.activeSidebarTabId === 'assets'
        const seen = seenHistoryJobIds.value

        for (const task of historyTasks) {
          const jobId = task.jobId
          if (!jobId || seen.has(jobId)) {
            continue
          }

          seen.add(jobId)

          if (!isAssetsTabOpen) {
            unseenAddedAssetsCount.value += getAddedAssetCount(task)
          }
        }
      },
      { immediate: true }
    )

    watch(
      () => sidebarTabStore.activeSidebarTabId,
      (activeSidebarTabId) => {
        if (activeSidebarTabId !== 'assets') {
          return
        }

        unseenAddedAssetsCount.value = 0
        markCurrentHistoryAsSeen()
      }
    )

    return {
      unseenAddedAssetsCount
    }
  }
)
