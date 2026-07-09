import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { flattenNodeOutput } from '@/renderer/extensions/linearMode/flattenNodeOutput'
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import type { ResultItemImpl } from '@/stores/queueStore'
import type { ExecutedWsMessage, JobId } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useJobPreviewStore } from '@/stores/jobPreviewStore'

// Max cards shown in the generating screen's fan before the oldest drop off.
export const GENERATING_CARD_LIMIT = 3

export const useLinearOutputStore = defineStore('linearOutput', () => {
  const { isAppMode } = useAppMode()
  const appModeStore = useAppModeStore()
  const executionStore = useExecutionStore()
  const jobPreviewStore = useJobPreviewStore()
  const workflowStore = useWorkflowStore()

  const inProgressItems = ref<InProgressItem[]>([])
  // Outputs from nodes not selected in the builder: shown in the generating
  // screen so every result still "pops", but never added to the output feed.
  const generatingExtraCards = ref<InProgressItem[]>([])
  const resolvedOutputsCache = new Map<string, ResultItemImpl[]>()
  const selectedId = ref<string | null>(null)
  const isFollowing = ref(true)
  const trackedJobId = ref<JobId | null>(null)
  const pendingResolve = ref(new Set<JobId>())
  const executedNodeIds = new Set<string>()

  const activeWorkflowInProgressItems = computed(() => {
    const path = workflowStore.activeWorkflow?.path
    if (!path) return []
    const all = inProgressItems.value
    return all.filter(
      (i) => executionStore.jobIdToSessionWorkflowPath.get(i.jobId) === path
    )
  })

  // Cards for the generating screen's fan: selected (feed) and non-selected
  // outputs interleaved by true arrival order so the newest is always first,
  // regardless of which list it came from. Scoped to the tracked job so
  // pending-resolve leftovers from a previous run never appear in a new fan.
  const generatingCards = computed<InProgressItem[]>(() =>
    [
      ...activeWorkflowInProgressItems.value.filter(
        (i) => i.jobId === trackedJobId.value
      ),
      ...generatingExtraCards.value
    ]
      .sort((a, b) => b.seq - a.seq)
      .slice(0, GENERATING_CARD_LIMIT)
  )

  let nextSeq = 0

  function createItem(
    jobId: JobId,
    props: Omit<InProgressItem, 'id' | 'jobId' | 'seq'>
  ): InProgressItem {
    const seq = nextSeq++
    return { id: `job-${jobId}-${seq}`, jobId, seq, ...props }
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

  function onJobStart(jobId: JobId) {
    executedNodeIds.clear()
    // Drop any non-selected cards left over from a previous run so back-to-back
    // jobs don't carry stale cards into the new fan.
    generatingExtraCards.value = []

    const item = createItem(jobId, { state: 'skeleton' })
    currentSkeletonId.value = item.id
    inProgressItems.value = [item, ...inProgressItems.value]

    trackedJobId.value = jobId
    autoSelect(`slot:${item.id}`, jobId)
  }

  let raf: number | null = null
  function onLatentPreview(jobId: JobId, url: string, nodeId?: string) {
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

      const item = createItem(jobId, { state: 'latent', latentPreviewUrl: url })
      currentSkeletonId.value = item.id
      inProgressItems.value = [item, ...inProgressItems.value]
      autoSelect(`slot:${item.id}`, jobId)
    })
  }

  function onNodeExecuted(jobId: JobId, detail: ExecutedWsMessage) {
    const nodeId = String(detail.display_node || detail.node)
    executedNodeIds.add(nodeId)
    if (raf) {
      cancelAnimationFrame(raf)
      raf = null
    }
    const newOutputs = flattenNodeOutput([nodeId, detail.output])
    if (newOutputs.length === 0) return

    // Outputs from nodes not selected in the builder stay out of the feed, but
    // still pop into the generating screen so the run feels alive.
    const outputNodeIds = appModeStore.selectedOutputs
    const isSelectedOutput =
      outputNodeIds.length === 0 ||
      outputNodeIds.some((id) => String(id) === String(nodeId))
    if (!isSelectedOutput) {
      if (jobId === trackedJobId.value) {
        const extras = newOutputs.map((o) =>
          createItem(jobId, { state: 'image', output: o })
        )
        // Only the newest GENERATING_CARD_LIMIT can ever surface in the fan, so
        // cap on insert rather than retaining every non-selected output.
        generatingExtraCards.value = [
          ...extras,
          ...generatingExtraCards.value
        ].slice(0, GENERATING_CARD_LIMIT)
      }
      return
    }

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

      const extras = newOutputs
        .slice(1)
        .map((o) => createItem(jobId, { state: 'image', output: o }))

      const idx = inProgressItems.value.indexOf(skeletonItem)
      const arr = [...inProgressItems.value]
      arr.splice(idx, 1, imageItem, ...extras)
      currentSkeletonId.value = null
      inProgressItems.value = arr
      return
    }

    // No skeleton — create image items directly (only for tracked job)
    if (jobId !== trackedJobId.value) return

    const newItems = newOutputs.map((o) =>
      createItem(jobId, { state: 'image', output: o })
    )
    autoSelect(`slot:${newItems[0].id}`, jobId)
    inProgressItems.value = [...newItems, ...inProgressItems.value]
  }

  function onJobComplete(jobId: JobId) {
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

  function removeJobItems(jobId: JobId) {
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

  function resolveIfReady(jobId: JobId, historyLoaded: boolean) {
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

  function isJobForActiveWorkflow(jobId: JobId): boolean {
    return (
      executionStore.jobIdToSessionWorkflowPath.get(jobId) ===
      workflowStore.activeWorkflow?.path
    )
  }

  function autoSelect(slotId: string, jobId: JobId) {
    // Only auto-select if the job belongs to the active workflow
    if (!isJobForActiveWorkflow(jobId)) return

    const sel = selectedId.value
    if (!sel || isFollowing.value) {
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
      if (!jobId) generatingExtraCards.value = []
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
    // Drop stale non-selected cards from a run that ended while away.
    if (!executionStore.activeJobId) generatingExtraCards.value = []
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
    generatingCards,
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
