import { watch } from 'vue'

import type { PromptQueuedEventPayload } from '@comfyorg/api-client/ComfyApi'

import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import {
  createListeners,
  reportIfRejected
} from '@/platform/nodeApi/shared/listeners'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  QueueHandle,
  RunSubmission,
  RunSubmittedEvent,
  Unsubscribe
} from '@/platform/nodeApi/v4/types'

import { executionIdsToRun } from './runNodes'

/** What the host's `queuePrompt` tells the queue. */
export interface QueueHost {
  /** The backend accepted a prompt of the run call `requestId`. */
  promptSubmitted(requestId: number, promptId: string, nodeCount: number): void
  /** The backend refused a prompt. */
  promptRejected(): void
  /** The host finished every run call it was processing. */
  queueSettled(): void
}

export function createQueue(nodes: NodeHandles): {
  queue: QueueHandle
  host: QueueHost
} {
  const runStarting = createHostEvent('queue.onBeforeRun', followRunsStarting)
  const awaitingCleanup = new Set<ReturnType<typeof createListeners<[]>>>()
  const submitted = new Map<number, RunSubmission[]>()
  const rejected = createListeners('queue.onRejected')

  function onBeforeRun(listener: () => unknown): Unsubscribe {
    if (typeof listener !== 'function') {
      throw invalidArgument('queue.onBeforeRun', 'a function to call', listener)
    }
    const cleanups = createListeners('queue.onBeforeRun')
    const stop = runStarting(() => {
      const cleanup: unknown = listener()
      if (typeof cleanup !== 'function') {
        reportIfRejected('queue.onBeforeRun', cleanup)
        return
      }
      cleanups.add(() => Reflect.apply(cleanup, undefined, []))
      awaitingCleanup.add(cleanups)
    })
    return () => {
      stop()
      awaitingCleanup.delete(cleanups)
      cleanups.drain()
    }
  }

  function followRunsSubmitted(emit: (event: RunSubmittedEvent) => void) {
    const onQueued = ({ detail }: CustomEvent<PromptQueuedEventPayload>) => {
      const { requestId } = detail
      if (requestId === undefined) return
      const submissions = submitted.get(requestId)
      if (!submissions) return
      submitted.delete(requestId)
      emit(submittedEvent(submissions))
    }
    api.addEventListener('promptQueued', onQueued)
    return () => api.removeEventListener('promptQueued', onQueued)
  }

  const queue: QueueHandle = Object.freeze({
    async run(options?: unknown) {
      const queueNodeIds = executionIdsToRun(options, nodes)
      if (queueNodeIds === null) return false
      const app = useApp()
      return queueNodeIds
        ? app.queuePrompt(0, 1, queueNodeIds)
        : app.queuePrompt(0)
    },
    onBeforeRun,
    onAfterRun: createHostEvent('queue.onAfterRun', followRunsSubmitted),
    onRejected(listener: () => void) {
      if (typeof listener !== 'function') {
        throw invalidArgument(
          'queue.onRejected',
          'a function to call',
          listener
        )
      }
      return rejected.add(listener)
    },
    pending: () => useQueuePendingTaskCountStore().count,
    onPendingChanged: createHostEvent<[number]>(
      'queue.onPendingChanged',
      (emit) =>
        watch(
          () => useQueuePendingTaskCountStore().count,
          (pending) => emit(pending)
        )
    ),
    async interrupt() {
      await api.interrupt(useExecutionStore().activeJobId)
    },
    onInterrupted: createHostEvent('queue.onInterrupted', followInterrupts),
    disableAutoQueue() {
      useQueueSettingsStore().mode = 'disabled'
    }
  })

  return {
    queue,
    host: {
      promptSubmitted(requestId, promptId, nodeCount) {
        const submissions = submitted.get(requestId) ?? []
        submissions.push({ promptId, nodeCount })
        submitted.set(requestId, submissions)
      },
      promptRejected: () => rejected.notify(),
      queueSettled() {
        submitted.clear()
        const settled = Array.from(awaitingCleanup)
        awaitingCleanup.clear()
        for (const cleanups of settled) cleanups.drain()
      }
    }
  }
}

function followRunsStarting(emit: () => void): () => void {
  const onQueueing = () => emit()
  api.addEventListener('promptQueueing', onQueueing)
  return () => api.removeEventListener('promptQueueing', onQueueing)
}

function followInterrupts(emit: () => void): () => void {
  const onInterrupted = () => emit()
  api.addEventListener('execution_interrupted', onInterrupted)
  return () => api.removeEventListener('execution_interrupted', onInterrupted)
}

function submittedEvent(
  submissions: readonly RunSubmission[]
): RunSubmittedEvent {
  return Object.freeze({
    promptIds: Object.freeze(submissions.map(({ promptId }) => promptId)),
    submissions: Object.freeze(
      submissions.map((submission) => Object.freeze({ ...submission }))
    )
  })
}
