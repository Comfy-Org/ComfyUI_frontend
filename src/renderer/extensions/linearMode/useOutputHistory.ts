import { useAsyncState } from '@vueuse/core'
import { computed, ref, watchEffect } from 'vue'

import type { IAssetsProvider } from '@/platform/assets/composables/media/IAssetsProvider'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { flattenNodeOutput } from '@/renderer/extensions/linearMode/flattenNodeOutput'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { getJobDetail } from '@/services/jobOutputCache'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionStore } from '@/stores/executionStore'
import type { ResultItemImpl } from '@/stores/queueStore'

export function useOutputHistory(): {
  outputs: IAssetsProvider
  allOutputs: (item?: AssetItem) => ResultItemImpl[]
  selectFirstHistory: () => void
} {
  const backingOutputs = useMediaAssets('output')
  void backingOutputs.fetchMediaList()
  const linearStore = useLinearOutputStore()
  const workflowStore = useWorkflowStore()
  const executionStore = useExecutionStore()
  const appModeStore = useAppModeStore()

  function filterByOutputNodes(items: ResultItemImpl[]): ResultItemImpl[] {
    const nodeIds = appModeStore.selectedOutputs
    if (!nodeIds.length) return items
    return items.filter((r) =>
      nodeIds.some((id) => String(id) === String(r.nodeId))
    )
  }

  const sessionMedia = computed(() => {
    const path = workflowStore.activeWorkflow?.path
    if (!path) return []

    const pathMap = executionStore.jobIdToSessionWorkflowPath

    return backingOutputs.media.value.filter((asset) => {
      const m = getOutputAssetMetadata(asset?.user_metadata)
      return m ? pathMap.get(m.jobId) === path : false
    })
  })

  const outputs: IAssetsProvider = {
    ...backingOutputs,
    media: sessionMedia,
    hasMore: ref(false),
    isLoadingMore: ref(false),
    loadMore: async () => {}
  }

  const resolvedCache = linearStore.resolvedOutputsCache
  const asyncRefs = new Map<
    string,
    ReturnType<typeof useAsyncState<ResultItemImpl[]>>['state']
  >()

  function allOutputs(item?: AssetItem): ResultItemImpl[] {
    if (!item?.id) return []

    const cached = resolvedCache.get(item.id)
    if (cached) return filterByOutputNodes(cached)

    const user_metadata = getOutputAssetMetadata(item.user_metadata)
    if (!user_metadata) return []

    // For recently completed jobs still pending resolve, derive order from
    // the in-progress items which are in correct execution order.
    if (linearStore.pendingResolve.has(user_metadata.jobId)) {
      const ordered = linearStore.inProgressItems
        .filter((i) => i.jobId === user_metadata.jobId && i.output)
        .map((i) => i.output!)
      if (ordered.length > 0) {
        resolvedCache.set(item.id, ordered)
        return filterByOutputNodes(ordered)
      }
    }

    // Use metadata when all outputs are present. The /jobs list endpoint
    // only returns preview_output (single item), so outputCount may exceed
    // allOutputs.length for multi-output jobs.
    if (
      user_metadata.allOutputs?.length &&
      (!user_metadata.outputCount ||
        user_metadata.outputCount <= user_metadata.allOutputs.length)
    ) {
      const reversed = user_metadata.allOutputs.toReversed()
      resolvedCache.set(item.id, reversed)
      return filterByOutputNodes(reversed)
    }

    // Async fallback for multi-output jobs — fetch full /jobs/{id} detail.
    // This can be hit if the user executes the job then switches tabs.
    const existing = asyncRefs.get(item.id)
    if (existing) return filterByOutputNodes(existing.value)

    const itemId = item.id
    const outputRef = useAsyncState(
      getJobDetail(user_metadata.jobId).then((jobDetail) => {
        if (!jobDetail?.outputs) return []
        const results = Object.entries(jobDetail.outputs)
          .flatMap(flattenNodeOutput)
          .toReversed()
        resolvedCache.set(itemId, results)
        return results
      }),
      []
    ).state
    asyncRefs.set(item.id, outputRef)
    return filterByOutputNodes(outputRef.value)
  }

  function selectFirstHistory() {
    const first = outputs.media.value[0]
    if (first) {
      linearStore.selectAsLatest(`history:${first.id}:0`)
    } else {
      linearStore.selectAsLatest(null)
    }
  }

  // Resolve in-progress items when history outputs are loaded.
  watchEffect(() => {
    if (linearStore.pendingResolve.size === 0) return
    for (const jobId of linearStore.pendingResolve) {
      const asset = outputs.media.value.find((a) => {
        const m = getOutputAssetMetadata(a?.user_metadata)
        return m?.jobId === jobId
      })
      if (!asset) continue
      const loaded = allOutputs(asset).length > 0
      if (loaded) {
        linearStore.resolveIfReady(jobId, true)
        if (!linearStore.selectedId) selectFirstHistory()
      }
    }
  })

  return { outputs, allOutputs, selectFirstHistory }
}
