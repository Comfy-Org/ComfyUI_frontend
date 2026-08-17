import type { ShallowRef } from 'vue'

import type { NodeId } from '@/renderer/core/layout/types'

const INITIAL_BATCH_SIZE = 8
const MIN_BATCH_SIZE = 2
const MAX_BATCH_SIZE = INITIAL_BATCH_SIZE * 2
const OVERRUN_BATCH_FLOOR = INITIAL_BATCH_SIZE
const QUEUE_DEADLINE_MS = 600

export function createMountAdmissionScheduler(
  mountedNodeIds: ShallowRef<Set<NodeId>>,
  frameBudgetMs: number
) {
  let queue: NodeId[] = []
  let frame: number | null = null
  let generation = 0
  let batchSize = INITIAL_BATCH_SIZE
  let lastDrainAt = 0
  let queueStartedAt = 0
  let disposed = false

  function cancelFrame(): void {
    generation++
    queue = []
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
  }

  function reset(): void {
    cancelFrame()
    batchSize = INITIAL_BATCH_SIZE
    lastDrainAt = 0
    queueStartedAt = 0
  }

  function scheduleDrain(): void {
    const scheduledGeneration = generation
    frame = requestAnimationFrame((now) => {
      if (scheduledGeneration !== generation) return
      drain(now)
    })
  }

  function drain(now: number): void {
    frame = null
    if (disposed || queue.length === 0) return

    const pastDeadline =
      queueStartedAt > 0 && now - queueStartedAt > QUEUE_DEADLINE_MS
    const floor = pastDeadline ? OVERRUN_BATCH_FLOOR : MIN_BATCH_SIZE

    if (lastDrainAt > 0) {
      const frameMs = now - lastDrainAt
      batchSize =
        frameMs > frameBudgetMs
          ? Math.max(floor, Math.floor(batchSize / 2))
          : Math.min(MAX_BATCH_SIZE, batchSize * 2)
    } else if (pastDeadline) {
      batchSize = Math.max(floor, batchSize)
    }
    lastDrainAt = now

    const next = new Set(mountedNodeIds.value)
    for (const nodeId of queue.splice(0, batchSize)) next.add(nodeId)
    mountedNodeIds.value = next

    if (queue.length > 0) scheduleDrain()
    else queueStartedAt = 0
  }

  function replace(enteringNodeIds: NodeId[], immediate = false): void {
    const previousStartedAt = queueStartedAt
    const previousBatchSize = batchSize
    const previousDrainAt = lastDrainAt
    reset()
    if (enteringNodeIds.length === 0) return

    if (immediate) {
      const next = new Set(mountedNodeIds.value)
      for (const nodeId of enteringNodeIds) next.add(nodeId)
      mountedNodeIds.value = next
      return
    }

    if (previousStartedAt) {
      queueStartedAt = previousStartedAt
      batchSize = previousBatchSize
      lastDrainAt = previousDrainAt
    } else {
      queueStartedAt = performance.now()
    }

    const synchronousBatchSize = previousStartedAt
      ? batchSize
      : INITIAL_BATCH_SIZE
    const next = new Set(mountedNodeIds.value)
    for (const nodeId of enteringNodeIds.slice(0, synchronousBatchSize)) {
      next.add(nodeId)
    }
    mountedNodeIds.value = next

    queue = enteringNodeIds.slice(synchronousBatchSize)
    if (queue.length > 0) scheduleDrain()
  }

  function dispose(): void {
    disposed = true
    reset()
  }

  return { replace, reset, dispose }
}
