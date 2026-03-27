import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { flattenNodeOutput } from '@/renderer/extensions/linearMode/flattenNodeOutput'
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import type { ResultItemImpl } from '@/stores/queueStore'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

import { useExecutionStore } from '@/stores/executionStore'
import { useJobPreviewStore } from '@/stores/jobPreviewStore'

export const useLinearOutputStore = defineStore('linearOutput', () => {
  const { isAppMode } = useAppMode()
  const executionStore = useExecutionStore()
  const jobPreviewStore = useJobPreviewStore()
  const workflowStore = useWorkflowStore()

  const inProgressItems = ref<InProgressItem[]>([])
  const resolvedOutputsCache = new Map<string, ResultItemImpl[]>()
  const selectedId = ref<string | null>(null)
  const isFollowing = ref(true)
  const trackedJobId = ref<string | null>(null)
  const pendingResolve = ref(new Set<string>())
  const executedNodeIds = new Set<string>()

  const activeWorkflowInProgressItems = computed(() => {
    const path = workflowStore.activeWorkflow?.path
    if (!path) return []
    const all = inProgressItems.value
    return all.filter(
      (i) => executionStore.jobIdToSessionWorkflowPath.get(i.jobId) === path
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

    // Track in-progress items for all output nodes, regardless of
    // which ones are selected for the grid view. This ensures the
    // full history shows every generated output.

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

    // No skeleton — create image items directly (only for tracked job)
    if (jobId !== trackedJobId.value) return

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

    const hasImages = inProgressItems.value.some(
      (i) => i.jobId === jobId && i.state === 'image'
    )

    if (hasImages) {
      // Remove non-image items (skeletons, latents), keep images for absorption
      inProgressItems.value = inProgressItems.value.filter(
        (i) => i.jobId !== jobId || i.state === 'image'
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

  // Watch both activeJobId and the path mapping together. The path mapping
  // may arrive after activeJobId due to a race between WebSocket
  // (execution_start) and the HTTP response (queuePrompt > storeJob).
  // Watching both ensures onJobStart fires once the mapping is available.
  watch(
    [
      () => executionStore.activeJobId,
      () => executionStore.jobIdToSessionWorkflowPath
    ],
    ([jobId], [oldJobId]) => {
      if (!isAppMode.value) return
      if (oldJobId && oldJobId !== jobId) {
        onJobComplete(oldJobId)
      }
      // Guard with trackedJobId to avoid double-starting when the
      // path mapping arrives after activeJobId was already set.
      if (
        jobId &&
        trackedJobId.value !== jobId &&
        isJobForActiveWorkflow(jobId)
      ) {
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
