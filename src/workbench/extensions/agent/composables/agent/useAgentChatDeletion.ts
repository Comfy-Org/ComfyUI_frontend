import { onScopeDispose } from 'vue'

import { AgentApiError } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { ChatDeleteSnapshot } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

const MAX_RETRY_AFTER_RETRIES = 2

interface HistoryDeleteStore {
  beginDelete: (id: string) => ChatDeleteSnapshot
  commitDelete: (id: string, options?: { tombstone?: boolean }) => void
  restoreDelete: (id: string, snapshot: ChatDeleteSnapshot) => void
}

interface UseAgentChatDeletionOptions {
  deleteThread: (id: string) => Promise<void>
  history: HistoryDeleteStore
  onOptimisticDelete: (id: string) => void
  onRestoreDelete: (id: string) => void
  onDeleteFailed: (id: string, retry: () => void, error: unknown) => void
  onFallbackRefresh?: () => void
}

type DeleteAttemptOutcome =
  | { kind: 'deleted' }
  | { kind: 'tombstone' }
  | { kind: 'retry'; delayMs: number }
  | { kind: 'failed'; error: unknown }

function isGoneDeleteError(error: unknown): boolean {
  return (
    error instanceof AgentApiError &&
    (error.status === 404 || error.status === 405)
  )
}

function retryAfterDelayMs(
  error: unknown,
  retryCount: number
): number | undefined {
  if (
    !(error instanceof AgentApiError) ||
    error.status !== 503 ||
    error.retryAfterSeconds === undefined ||
    retryCount >= MAX_RETRY_AFTER_RETRIES
  )
    return undefined
  return error.retryAfterSeconds * 1000
}

function waitForRetryDelay(
  delayMs: number,
  signal: AbortSignal
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(false)
    }, delayMs)
    function onAbort() {
      clearTimeout(timer)
      resolve(true)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function useAgentChatDeletion({
  deleteThread,
  history,
  onOptimisticDelete,
  onRestoreDelete,
  onDeleteFailed,
  onFallbackRefresh
}: UseAgentChatDeletionOptions) {
  const inFlight = new Set<string>()
  const disposeController = new AbortController()

  onScopeDispose(() => disposeController.abort())

  const isDisposed = (): boolean => disposeController.signal.aborted

  async function tryDeleteOnce(
    id: string,
    retryCount: number
  ): Promise<DeleteAttemptOutcome> {
    try {
      await deleteThread(id)
      return { kind: 'deleted' }
    } catch (error) {
      if (isGoneDeleteError(error)) return { kind: 'tombstone' }
      const delayMs = retryAfterDelayMs(error, retryCount)
      return delayMs !== undefined
        ? { kind: 'retry', delayMs }
        : { kind: 'failed', error }
    }
  }

  function handleFailure(
    id: string,
    snapshot: ChatDeleteSnapshot,
    error: unknown
  ): void {
    history.restoreDelete(id, snapshot)
    onRestoreDelete(id)
    if (snapshot.session === undefined) onFallbackRefresh?.()
    onDeleteFailed(
      id,
      () => {
        void deleteChat(id)
      },
      error
    )
  }

  async function deleteChat(id: string): Promise<void> {
    if (isDisposed() || inFlight.has(id)) return
    inFlight.add(id)
    const snapshot = history.beginDelete(id)
    onOptimisticDelete(id)

    try {
      for (let retryCount = 0; !isDisposed(); retryCount += 1) {
        const outcome = await tryDeleteOnce(id, retryCount)
        if (isDisposed()) return
        if (outcome.kind === 'deleted') {
          history.commitDelete(id)
          return
        }
        if (outcome.kind === 'tombstone') {
          history.commitDelete(id, { tombstone: true })
          return
        }
        if (outcome.kind === 'failed') {
          handleFailure(id, snapshot, outcome.error)
          return
        }
        if (await waitForRetryDelay(outcome.delayMs, disposeController.signal))
          return
      }
    } finally {
      inFlight.delete(id)
    }
  }

  return { deleteChat }
}
