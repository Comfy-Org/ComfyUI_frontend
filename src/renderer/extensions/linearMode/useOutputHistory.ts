import { useAsyncState } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { computed, ref, watchEffect } from 'vue'

import type { IAssetsProvider } from '@/platform/assets/composables/media/IAssetsProvider'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import type {
  NonAssetEntry,
  TimelineItem
} from '@/renderer/extensions/linearMode/linearModeTypes'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { getJobDetail } from '@/services/jobOutputCache'
import { api } from '@/scripts/api'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import type { ResultItemImpl } from '@/stores/queueStore'

function makeNonAssetItem(
  entry: NonAssetEntry,
  groupKey: string
): TimelineItem {
  return {
    id: `nonasset:${entry.id}`,
    output: entry.output,
    groupKey,
    selectionValue: {
      id: `nonasset:${entry.id}`,
      kind: 'nonAsset',
      itemId: entry.id
    }
  }
}

function indexByJobId(entries: NonAssetEntry[]): Map<string, NonAssetEntry[]> {
  const map = new Map<string, NonAssetEntry[]>()
  for (const entry of entries) {
    const list = map.get(entry.jobId) ?? []
    list.push(entry)
    map.set(entry.jobId, list)
  }
  return map
}

export function buildTimeline(
  visibleHistory: AssetItem[],
  nonAssetOutputs: NonAssetEntry[],
  allOutputsFn: (asset: AssetItem) => ResultItemImpl[]
): TimelineItem[] {
  const items: TimelineItem[] = []
  const nonAssetByJobId = indexByJobId(nonAssetOutputs)

  // Collect jobIds that have a matching history entry
  const pairedJobIds = new Set<string>()
  for (const asset of visibleHistory) {
    const m = getOutputAssetMetadata(asset.user_metadata)
    if (m?.jobId && nonAssetByJobId.has(m.jobId)) pairedJobIds.add(m.jobId)
  }

  // Orphan compare outputs whose job has no loaded history entry yet
  for (const entry of nonAssetOutputs) {
    if (pairedJobIds.has(entry.jobId)) continue
    items.push(makeNonAssetItem(entry, 'orphans'))
  }

  // History groups with compare outputs placed before their saved outputs
  for (const asset of visibleHistory) {
    const m = getOutputAssetMetadata(asset.user_metadata)
    const siblings = m?.jobId ? (nonAssetByJobId.get(m.jobId) ?? []) : []
    for (const entry of siblings) {
      items.push(makeNonAssetItem(entry, asset.id))
    }
    const outs = allOutputsFn(asset)
    for (let k = 0; k < outs.length; k++) {
      items.push({
        id: `history:${asset.id}:${k}`,
        output: outs[k],
        groupKey: asset.id,
        selectionValue: {
          id: `history:${asset.id}:${k}`,
          kind: 'history',
          assetId: asset.id,
          key: k
        }
      })
    }
  }

  return items
}

export function useOutputHistory(): {
  outputs: IAssetsProvider
  allOutputs: (item?: AssetItem) => ResultItemImpl[]
  timeline: ComputedRef<TimelineItem[]>
  selectFirstHistory: () => void
  mayBeActiveWorkflowPending: ComputedRef<boolean>
  isWorkflowActive: ComputedRef<boolean>
  cancelActiveWorkflowJobs: () => Promise<void>
} {
  const backingOutputs = useMediaAssets('output')
  void backingOutputs.fetchMediaList()
  const linearStore = useLinearOutputStore()
  const workflowStore = useWorkflowStore()
  const executionStore = useExecutionStore()
  const appModeStore = useAppModeStore()
  const queueStore = useQueueStore()

  function matchesActiveWorkflow(task: { jobId: string | number }): boolean {
    const path = workflowStore.activeWorkflow?.path
    if (!path) return false
    return (
      executionStore.jobIdToSessionWorkflowPath.get(String(task.jobId)) === path
    )
  }

  function hasActiveWorkflowJobs(): boolean {
    if (!workflowStore.activeWorkflow?.path) return false
    return queueStore.runningTasks.some(matchesActiveWorkflow)
  }

  // True when there are queued/running jobs for the active workflow but no
  // in-progress output items yet.
  const mayBeActiveWorkflowPending = computed(() => {
    if (linearStore.activeWorkflowInProgressItems.length > 0) return false
    return hasActiveWorkflowJobs()
  })

  // True when the active workflow has running/pending jobs or in-progress items.
  const isWorkflowActive = computed(
    () =>
      linearStore.activeWorkflowInProgressItems.length > 0 ||
      hasActiveWorkflowJobs()
  )

  function filterByOutputNodes(items: ResultItemImpl[]): ResultItemImpl[] {
    const nodeIds = appModeStore.selectedOutputs
    if (!nodeIds.length) return []
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
        user_metadata.outputCount <= user_metadata.allOutputs.length) &&
      item.preview_url
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
          .flatMap(([nodeId, output]) => parseNodeOutput(nodeId, output))
          .toReversed()
        resolvedCache.set(itemId, results)
        return results
      }),
      []
    ).state
    asyncRefs.set(item.id, outputRef)
    return filterByOutputNodes(outputRef.value)
  }

  const visibleHistory = computed(() =>
    outputs.media.value.filter((a) => allOutputs(a).length > 0)
  )

  const timeline = computed(() =>
    buildTimeline(
      visibleHistory.value,
      linearStore.activeWorkflowNonAssetOutputs,
      allOutputs
    )
  )

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
        if (!linearStore.selectedId) {
          const nonAsset = linearStore.activeWorkflowNonAssetOutputs.find(
            (e) => e.jobId === jobId
          )
          if (nonAsset) {
            linearStore.selectAsLatest(`nonasset:${nonAsset.id}`)
          } else {
            selectFirstHistory()
          }
        }
      }
    }
  })

  async function cancelActiveWorkflowJobs() {
    if (!workflowStore.activeWorkflow?.path) return

    // Interrupt the running job if it belongs to this workflow
    if (queueStore.runningTasks.some(matchesActiveWorkflow)) {
      void useCommandStore().execute('Comfy.Interrupt')
    } else {
      // Delete first pending job for this workflow from the queue
      for (const task of queueStore.pendingTasks) {
        if (matchesActiveWorkflow(task)) {
          await api.deleteItem('queue', String(task.jobId))
          break
        }
      }
    }
  }

  return {
    outputs,
    allOutputs,
    timeline,
    selectFirstHistory,
    mayBeActiveWorkflowPending,
    isWorkflowActive,
    cancelActiveWorkflowJobs
  }
}
