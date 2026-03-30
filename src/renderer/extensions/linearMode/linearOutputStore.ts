import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { flattenNodeOutput } from '@/renderer/extensions/linearMode/flattenNodeOutput'
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import type { ResultItemImpl } from '@/stores/queueStore'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useJobPreviewStore } from '@/stores/jobPreviewStore'

const MAX_NON_ASSET_OUTPUTS = 64

export const useLinearOutputStore = defineStore('linearOutput', () => {
  const { isAppMode } = useAppMode()
  const appModeStore = useAppModeStore()
  const executionStore = useExecutionStore()
  const jobPreviewStore = useJobPreviewStore()
  const workflowStore = useWorkflowStore()

  const inProgressItems = ref<InProgressItem[]>([])
  const completedNonAssetOutputs = ref<
    { id: string; jobId: string; output: ResultItemImpl }[]
  >([])
  const resolvedOutputsCache = new Map<string, ResultItemImpl[]>()
  const selectedId = ref<string | null>(null)
  const isFollowing = ref(true)
  const trackedJobId = ref<string | null>(null)
  const pendingResolve = ref(new Set<string>())
  const executedNodeIds = new Set<string>()

  const activeWorkflowInProgressItems = computed(() => {
    const path = workflowStore.activeWorkflow?.path
    if (!path) return []
    return inProgressItems.value.filter(
      (i) => executionStore.jobIdToSessionWorkflowPath.get(i.jobId) === path
    )
  })

  const activeWorkflowNonAssetOutputs = computed(() => {
    const path = workflowStore.activeWorkflow?.path
    if (!path) return []
    return completedNonAssetOutputs.value.filter(
      (e) => executionStore.jobIdToSessionWorkflowPath.get(e.jobId) === path
    )
  })

  let nextSeq = 0

  function makeItemId(jobId: string): string {
    return `job-${jobId}-${nextSeq++}`
  }

  function replaceItem(
    id: string,
    updater: (item: InProgressItem) => InProgressItem
  ) {
    inProgressItems.value = inProgressItems.value.map((i) =>
      i.id === id ? updater(i) : i
    )
  }

  // --- Actions ---

  const currentSkeletonId = shallowRef<string | null>(null)

  function onJobStart(jobId: string) {
    executedNodeIds.clear()

    const item: InProgressItem = {
      id: makeItemId(jobId),
      jobId,
      state: 'skeleton'
    }
    currentSkeletonId.value = item.id
    inProgressItems.value = [item, ...inProgressItems.value]

    trackedJobId.value = jobId
    autoSelect(`slot:${item.id}`, jobId)
  }

  let raf: number | null = null
  function onLatentPreview(jobId: string, url: string, nodeId?: string) {
    if (nodeId && executedNodeIds.has(nodeId)) return

    // Issue in Firefox where it doesnt seem to always re-render, wrapping in RAF fixes it
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const existing = inProgressItems.value.find(
        (i) => i.id === currentSkeletonId.value && i.jobId === jobId
      )

      if (existing) {
        const wasEmpty = existing.state === 'skeleton'
        replaceItem(existing.id, (i) => ({
          ...i,
          state: 'latent',
          latentPreviewUrl: url
        }))
        if (wasEmpty) autoSelect(`slot:${existing.id}`, jobId)
        return
      }

      // Only create on-demand for the tracked job
      if (jobId !== trackedJobId.value) return

      const item: InProgressItem = {
        id: makeItemId(jobId),
        jobId,
        state: 'latent',
        latentPreviewUrl: url
      }
      currentSkeletonId.value = item.id
      inProgressItems.value = [item, ...inProgressItems.value]
      autoSelect(`slot:${item.id}`, jobId)
    })
  }

  function onNodeExecuted(jobId: string, detail: ExecutedWsMessage) {
    const nodeId = String(detail.display_node || detail.node)
    executedNodeIds.add(nodeId)
    if (raf) {
      cancelAnimationFrame(raf)
      raf = null
    }
    const newOutputs = flattenNodeOutput([nodeId, detail.output])
    if (newOutputs.length === 0) return

    // Skip output items for nodes not flagged as output nodes
    const outputNodeIds = appModeStore.selectedOutputs
    if (
      outputNodeIds.length > 0 &&
      !outputNodeIds.some((id) => String(id) === String(nodeId))
    )
      return

    const skeletonItem = inProgressItems.value.find(
      (i) => i.id === currentSkeletonId.value && i.jobId === jobId
    )

    if (skeletonItem) {
      const imageItem: InProgressItem = {
        ...skeletonItem,
        state: 'image',
        output: newOutputs[0],
        latentPreviewUrl: undefined
      }
      autoSelect(`slot:${imageItem.id}`, jobId)

      const extras: InProgressItem[] = newOutputs.slice(1).map((o) => ({
        id: makeItemId(jobId),
        jobId,
        state: 'image' as const,
        output: o
      }))

      const idx = inProgressItems.value.indexOf(skeletonItem)
      const arr = [...inProgressItems.value]
      arr.splice(idx, 1, imageItem, ...extras)
      currentSkeletonId.value = null
      inProgressItems.value = arr
      return
    }

    // No skeleton — create image items directly.
    // handleExecuted already verified jobId === activeJobId, so start
    // tracking if we haven't yet (covers nodes that fire before
    // onJobStart, e.g. ImageCompare with no SaveImage in the workflow).
    if (!trackedJobId.value) {
      trackedJobId.value = jobId
    } else if (jobId !== trackedJobId.value) {
      return
    }

    const newItems: InProgressItem[] = newOutputs.map((o) => ({
      id: makeItemId(jobId),
      jobId,
      state: 'image' as const,
      output: o
    }))
    autoSelect(`slot:${newItems[0].id}`, jobId)
    inProgressItems.value = [...newItems, ...inProgressItems.value]
  }

  function onJobComplete(jobId: string) {
    // On any job complete, remove all pending resolve items.
    if (pendingResolve.value.size > 0) {
      for (const oldJobId of pendingResolve.value) {
        removeJobItems(oldJobId)
      }
      pendingResolve.value = new Set()
    }

    if (raf) {
      cancelAnimationFrame(raf)
      raf = null
    }
    currentSkeletonId.value = null
    if (trackedJobId.value === jobId) {
      trackedJobId.value = null
    }

    const jobImageItems = inProgressItems.value.filter(
      (i) => i.jobId === jobId && i.state === 'image'
    )

    // Move non-asset outputs (e.g. image_compare) to their own collection
    // since they won't appear in history.
    const nonAssetItems = jobImageItems.filter((i) => i.output?.isImageCompare)
    if (nonAssetItems.length > 0) {
      completedNonAssetOutputs.value = [
        ...nonAssetItems.map((i) => ({
          id: i.id,
          jobId,
          output: i.output!
        })),
        ...completedNonAssetOutputs.value
      ].slice(0, MAX_NON_ASSET_OUTPUTS)
    }

    // Keep only asset images for history absorption, remove everything else.
    const hasAssetOutputs = jobImageItems.some((i) => !i.output?.isImageCompare)
    if (hasAssetOutputs) {
      inProgressItems.value = inProgressItems.value.filter(
        (i) =>
          i.jobId !== jobId ||
          (i.state === 'image' && !i.output?.isImageCompare)
      )
      pendingResolve.value = new Set([...pendingResolve.value, jobId])
    } else {
      removeJobItems(jobId)
    }
  }

  function removeJobItems(jobId: string) {
    const removed = inProgressItems.value.filter((i) => i.jobId === jobId)
    inProgressItems.value = inProgressItems.value.filter(
      (i) => i.jobId !== jobId
    )

    if (
      selectedId.value &&
      removed.some((i) => `slot:${i.id}` === selectedId.value)
    ) {
      selectedId.value = null
    }
  }

  function resolveIfReady(jobId: string, historyLoaded: boolean) {
    if (!pendingResolve.value.has(jobId)) return
    if (!historyLoaded) return

    const next = new Set(pendingResolve.value)
    next.delete(jobId)
    pendingResolve.value = next

    removeJobItems(jobId)
  }

  function select(id: string | null) {
    selectedId.value = id
    isFollowing.value = false
  }

  function selectAsLatest(id: string | null) {
    selectedId.value = id
    isFollowing.value = true
  }

  function isJobForActiveWorkflow(jobId: string): boolean {
    return (
      executionStore.jobIdToSessionWorkflowPath.get(jobId) ===
      workflowStore.activeWorkflow?.path
    )
  }

  function autoSelect(slotId: string, jobId: string) {
    // Only auto-select if the job belongs to the active workflow
    if (!isJobForActiveWorkflow(jobId)) return

    const sel = selectedId.value
    if (!sel || sel.startsWith('slot:') || isFollowing.value) {
      selectedId.value = slotId
      isFollowing.value = true
      return
    }
    // User is browsing history — don't yank
  }

  // --- Event bindings (only active in app mode) ---

  function handleExecuted({ detail }: CustomEvent<ExecutedWsMessage>) {
    const jobId = detail.prompt_id
    if (jobId !== executionStore.activeJobId) return
    onNodeExecuted(jobId, detail)
  }

  watch(
    () => executionStore.activeJobId,
    (jobId, oldJobId) => {
      if (!isAppMode.value) return
      if (oldJobId && oldJobId !== jobId) {
        onJobComplete(oldJobId)
      }
      // Start tracking only if the job belongs to this workflow.
      // Jobs from other workflows are picked up by reconcileOnEnter
      // when the user switches to that workflow's tab.
      if (jobId && isJobForActiveWorkflow(jobId)) {
        onJobStart(jobId)
      }
    }
  )

  watch(
    () => jobPreviewStore.nodePreviewsByPromptId,
    (previews) => {
      if (!isAppMode.value) return
      const jobId = executionStore.activeJobId
      if (!jobId) return
      const preview = previews[jobId]
      if (preview) onLatentPreview(jobId, preview.url, preview.nodeId)
    },
    { deep: true }
  )

  function reconcileOnEnter() {
    // Complete any tracked job that finished while we were away.
    // The activeJobId watcher couldn't fire onJobComplete because
    // isAppMode was false at the time.
    if (
      trackedJobId.value &&
      trackedJobId.value !== executionStore.activeJobId
    ) {
      onJobComplete(trackedJobId.value)
    }
    // Start tracking the current job only if it belongs to this
    // workflow — otherwise we'd adopt another tab's job.
    if (
      executionStore.activeJobId &&
      trackedJobId.value !== executionStore.activeJobId &&
      isJobForActiveWorkflow(executionStore.activeJobId)
    ) {
      onJobStart(executionStore.activeJobId)
    }

    // Clear stale selection from another workflow's job.
    if (
      selectedId.value?.startsWith('slot:') &&
      trackedJobId.value &&
      !isJobForActiveWorkflow(trackedJobId.value)
    ) {
      selectedId.value = null
      isFollowing.value = true
    }

    // Re-apply the latest latent preview that may have arrived while
    // away, but only for a job belonging to the active workflow.
    const jobId = trackedJobId.value
    if (jobId && isJobForActiveWorkflow(jobId)) {
      const preview = jobPreviewStore.nodePreviewsByPromptId[jobId]
      if (preview) onLatentPreview(jobId, preview.url, preview.nodeId)
    }
  }

  function cleanupOnLeave() {
    // If the tracked job already finished (no longer the active job),
    // complete it now to clean up skeletons/latents. If it's still
    // running, preserve all items for tab switching.
    if (
      trackedJobId.value &&
      trackedJobId.value !== executionStore.activeJobId
    ) {
      onJobComplete(trackedJobId.value)
    }
  }

  watch(
    isAppMode,
    (active, wasActive) => {
      if (active) {
        api.addEventListener('executed', handleExecuted)
        reconcileOnEnter()
      } else if (wasActive) {
        api.removeEventListener('executed', handleExecuted)
        cleanupOnLeave()
      }
    },
    { immediate: true }
  )

  return {
    activeWorkflowInProgressItems,
    activeWorkflowNonAssetOutputs,
    resolvedOutputsCache,
    selectedId,
    pendingResolve,
    select,
    selectAsLatest,
    resolveIfReady,
    inProgressItems,
    onJobStart,
    onLatentPreview,
    onNodeExecuted,
    onJobComplete
  }
})
