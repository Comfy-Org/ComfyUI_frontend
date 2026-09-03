/**
 * Starting a run, and knowing when one starts.
 *
 * Packs reached for `app.queuePrompt` in three shapes: a folder watcher that
 * ran the workflow when a file appeared, a button that both set a value and
 * ran, and a "run just this node" feature built by wrapping `api.queuePrompt`
 * and rewriting `prompt.output` down to one node's upstream cone.
 *
 * The first two are `run()`. The third is `run({ nodes })` — partial execution
 * is a first-class host feature now, so the prompt rewriting that packs used to
 * do by hand is not needed and is not published. Nothing here lets a pack
 * inspect or edit the built prompt: that is the surface that made the old API
 * impossible to retire, and rebuilding it would forfeit the migration.
 */
import { watch } from 'vue'

import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import type {
  PromptQueuedEventPayload,
  PromptRejectedEventPayload
} from '@/scripts/api'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import {
  isInstantMode,
  useQueueSettingsStore
} from '@/stores/queueSettingsStore'
import { toNodeId } from '@/types/nodeId'
import { getExecutionIdsForSelectedNodes } from '@/utils/graphTraversalUtil'
import type { LGraph } from '@/lib/litegraph/src/litegraph'

import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
import type { Unsubscribe } from './widgetHandle'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface RunOptions {
  /**
   * Run only these nodes and whatever feeds them, instead of the whole
   * workflow. Empty is rejected rather than treated as "everything": a filter
   * that matched nothing must not silently run the entire graph.
   */
  nodes?: readonly NodeHandle[]
  /** How many times to run. Defaults to 1. */
  batch?: number
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface RunSubmittedEvent {
  /** Ids the backend accepted, in submission order. */
  readonly promptIds: readonly string[]
  /** The accepted prompts and how many backend nodes each will execute. */
  readonly submissions?: readonly RunSubmission[]
  /** How many submissions the backend refused. */
  readonly rejected: number
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface RunSubmission {
  readonly promptId: string
  readonly nodeCount: number
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface RunRejectionError {
  readonly type: string
  readonly message: string
  readonly details: string
  readonly inputName?: string
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface RunRejectedNode {
  readonly nodeId: string
  readonly nodeType: string
  readonly errors: readonly RunRejectionError[]
}

export interface RunRejectedEvent {
  readonly status?: number
  readonly error: RunRejectionError
  readonly nodeErrors: readonly RunRejectedNode[]
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type AutoQueueMode = 'disabled' | 'change' | 'instant'

export interface QueueHandle {
  /**
   * Queues the current workflow, exactly as pressing Run does.
   *
   * Resolves once the prompt has been submitted — not when it finishes
   * executing. `false` means another queue call was already in flight and this
   * one was folded into it.
   */
  run(options?: RunOptions): Promise<boolean>
  /**
   * A run is about to be submitted.
   *
   * This is `beforeQueuing`. For a last write before the prompt is built —
   * syncing a value the pack keeps outside the widget. Keep it synchronous:
   * the prompt build does not wait, so work started here can lose the race.
   */
  /**
   * Return a function to have it run when the attempt is over — whether the
   * run started, was refused, or threw.
   *
   * For a pack that changes the graph to build the prompt and must put it back:
   * unmute a branch, let the prompt be built, re-mute it. Pairing it with the
   * setup rather than publishing a second top-level event is deliberate — you
   * cannot receive the cleanup without having run the setup, and there is no
   * second "after" member to confuse with {@link onAfterRun}, which means
   * something different and narrower.
   */
  onBeforeRun(listener: () => (() => void) | void): Unsubscribe
  /**
   * A run was submitted. This is `afterQueued` — for advancing state that
   * should differ on the next run.
   *
   * The event names what the backend accepted, so a pack can tie its own
   * progress tracking to the run it started rather than guessing that the next
   * execution message belongs to it. Each submission includes the exact count
   * of executable backend nodes without exposing the built prompt. `rejected`
   * is how many submissions the backend refused: `onBeforeRun` fires either
   * way, so without this a pack cannot tell a run that started from one that
   * never did.
   */
  onAfterRun(listener: (event: RunSubmittedEvent) => void): Unsubscribe
  /**
   * The backend refused a submitted prompt before execution began.
   *
   * This exposes prompt and per-node validation details without coupling a
   * pack to host notifications. It does not fire for transport failures or an
   * error raised after execution starts.
   */
  onRejected(listener: (event: RunRejectedEvent) => void): Unsubscribe
  /**
   * How many runs are waiting, including the one executing.
   *
   * Packs tracked this from the backend's own `status` message to re-implement
   * `app.ui.lastQueueSize` — deciding whether a button says Run or Cancel,
   * whether an auto-runner should submit again.
   */
  pending(): number
  /** Fires whenever {@link pending} changes, with the new count. */
  onPendingChanged(listener: (pending: number) => void): Unsubscribe
  /**
   * Cancels the run in progress. The rest of the queue is untouched.
   *
   * Packs wrapped `api.interrupt` both to call it and to notice one — a node
   * waiting on the user needs to stop waiting when the run is cancelled.
   * {@link onInterrupted} is that second half.
   */
  interrupt(): Promise<void>
  /** Execution was interrupted, by this pack, another, or the user. */
  onInterrupted(listener: () => void): Unsubscribe
  /** The user-facing automatic queue mode. Both internal instant states read as `instant`. */
  autoQueueMode(): AutoQueueMode
  /** Changes automatic queuing. `instant` arms continuous execution. */
  setAutoQueueMode(mode: AutoQueueMode): void
  /** The batch count the host's own Run action will use. */
  batchCount(): number
  /** Changes the host Run action's batch count. */
  setBatchCount(count: number): void
  /**
   * Turns off automatic queuing without cancelling the current run.
   *
   * A conditional workflow can use this before interrupting itself so the
   * stopped iteration does not immediately start again.
   */
  disableAutoQueue(): void
  /**
   * Holds a run until a check finishes, and can cancel it.
   *
   * {@link onBeforeRun} only observes: it is a notification, and the prompt
   * build does not wait. Packs that needed to *stop* a run — confirm an
   * incoming prompt, validate a field, warn about a cost — wrapped
   * `app.queuePrompt` to do it, which is the surface being retired.
   *
   * Return `false` to cancel. Every guard runs, and any one `false` cancels;
   * the user is not asked twice.
   *
   * A guard that never settles would make the application unrunnable, so one
   * that takes longer than a few seconds is abandoned and the run proceeds. Do
   * not put a dialog with no timeout behind this.
   */
  guard(check: () => boolean | Promise<boolean>): Unsubscribe
}

/** Registered guards, module-level so the host can consult them. */
const guards = new Set<() => boolean | Promise<boolean>>()

/** How long every guard together may take before the run proceeds regardless. */
const GUARD_TIMEOUT_MS = 5_000

function assertBatchCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new ComfyApiError('Batch count must be a positive integer.')
  }
}

/**
 * Asks every guard whether this run may proceed. Called by the host once per
 * queued item, before the prompt is built.
 */
export async function mayRun(): Promise<boolean> {
  if (!guards.size) return true
  const asked = [...guards].map(async (check) => {
    try {
      return await check()
    } catch (error) {
      reportError(error, { errorType: 'queue_guard_threw' })
      return true
    }
  })
  let timeout: ReturnType<typeof setTimeout> | undefined
  const verdicts = await Promise.race([
    Promise.all(asked),
    new Promise<true[]>((resolve) => {
      timeout = setTimeout(() => {
        reportError(
          new ComfyApiError(
            `A queue guard did not settle within ${GUARD_TIMEOUT_MS}ms.`
          ),
          { errorType: 'queue_guard_timeout' }
        )
        resolve([true])
      }, GUARD_TIMEOUT_MS)
    })
  ])
  if (timeout !== undefined) clearTimeout(timeout)
  return verdicts.every((allowed) => allowed)
}

function subscribe(event: 'promptQueueing' | 'execution_interrupted') {
  return (listener: () => void): Unsubscribe => {
    const wrapped = () => listener()
    api.addEventListener(event, wrapped)
    return () => api.removeEventListener(event, wrapped)
  }
}

function executionIds(
  nodes: readonly NodeHandle[],
  graph: LGraph | null | undefined
) {
  const resolved = nodes.map((node) => graph?.getNodeById(toNodeId(node.id)))
  const missing = nodes.filter((_, i) => !resolved[i]).map((n) => n.id)
  if (missing.length) {
    throw new ComfyApiError(
      `Cannot run nodes not in the graph: ${missing.join(', ')}.`
    )
  }
  const ids = getExecutionIdsForSelectedNodes(resolved.filter((n) => !!n))
  if (!ids.length) {
    throw new ComfyApiError(
      'Could not resolve an execution path for the given nodes.'
    )
  }
  return ids
}

function normalizeRejectionError(
  error: PromptRejectedEventPayload['response']['error']
): RunRejectionError {
  if (typeof error === 'string') {
    return Object.freeze({
      type: 'prompt_rejected',
      message: error,
      details: ''
    })
  }
  return Object.freeze({
    type: error.type,
    message: error.message,
    details: error.details
  })
}

function normalizeRejection(
  detail: PromptRejectedEventPayload
): RunRejectedEvent {
  const nodeErrors = Object.entries(detail.response.node_errors ?? {}).map(
    ([nodeId, nodeError]) =>
      Object.freeze({
        nodeId,
        nodeType: nodeError.class_type,
        errors: Object.freeze(
          nodeError.errors.map((error) =>
            Object.freeze({
              type: error.type,
              message: error.message,
              details: error.details,
              ...(error.extra_info?.input_name === undefined
                ? {}
                : { inputName: error.extra_info.input_name })
            })
          )
        )
      })
  )
  return Object.freeze({
    ...(detail.status === undefined ? {} : { status: detail.status }),
    error: normalizeRejectionError(detail.response.error),
    nodeErrors: Object.freeze(nodeErrors)
  })
}

export function createQueueApi(
  getGraph: () => LGraph | null | undefined
): QueueHandle {
  return Object.freeze({
    async run({ nodes, batch = 1 }: RunOptions = {}) {
      assertBatchCount(batch)
      if (nodes && !nodes.length) {
        throw new ComfyApiError(
          'run({ nodes }) needs at least one node. Omit `nodes` to run the whole workflow.'
        )
      }
      // Imported lazily: `app` pulls in most of the application, and a static
      // import would drag it into any pack's first import of the API.
      const { app } = await import('@/scripts/app')
      return nodes
        ? app.queuePrompt(0, batch, executionIds(nodes, getGraph()))
        : app.queuePrompt(0, batch)
    },

    onBeforeRun(listener: () => (() => void) | void) {
      let cleanUp: (() => void) | void
      const started = () => {
        cleanUp = listener()
      }
      // One-shot per attempt: the end always follows a start, and re-running a
      // stale cleanup would undo a mutation the next attempt had just made.
      const ended = () => {
        const run = cleanUp
        cleanUp = undefined
        run?.()
      }
      api.addEventListener('promptQueueing', started)
      api.addEventListener('promptQueueAttemptEnded', ended)
      return () => {
        api.removeEventListener('promptQueueing', started)
        api.removeEventListener('promptQueueAttemptEnded', ended)
      }
    },
    onAfterRun(listener: (event: RunSubmittedEvent) => void) {
      const wrapped = (e: Event) => {
        const detail = extensionValue(
          (e as CustomEvent<PromptQueuedEventPayload>).detail
        )
        listener(
          Object.freeze({
            promptIds: Object.freeze([...(detail?.promptIds ?? [])]),
            ...(detail?.submissions
              ? {
                  submissions: Object.freeze(
                    detail.submissions.map((submission) =>
                      Object.freeze({ ...submission })
                    )
                  )
                }
              : {}),
            rejected: detail?.rejectedCount ?? 0
          })
        )
      }
      api.addEventListener('promptQueued', wrapped)
      return () => api.removeEventListener('promptQueued', wrapped)
    },
    onRejected(listener: (event: RunRejectedEvent) => void) {
      const wrapped = (event: Event) => {
        const detail = (event as CustomEvent<PromptRejectedEventPayload>).detail
        listener(normalizeRejection(detail))
      }
      api.addEventListener('promptRejected', wrapped)
      return () => api.removeEventListener('promptRejected', wrapped)
    },

    pending: () => useQueuePendingTaskCountStore().count,

    onPendingChanged(listener: (pending: number) => void) {
      const store = useQueuePendingTaskCountStore()
      return watch(
        () => store.count,
        (pending) => listener(pending)
      )
    },

    async interrupt() {
      // null: cancel whatever is running, rather than a job the pack names.
      // A pack cannot know a job id it was never told.
      await api.interrupt(null)
    },

    onInterrupted: subscribe('execution_interrupted'),

    autoQueueMode() {
      const { mode } = useQueueSettingsStore()
      return isInstantMode(mode) ? 'instant' : mode
    },

    setAutoQueueMode(mode: AutoQueueMode) {
      useQueueSettingsStore().mode =
        mode === 'instant' ? 'instant-running' : mode
    },

    batchCount() {
      return useQueueSettingsStore().batchCount
    },

    setBatchCount(count: number) {
      assertBatchCount(count)
      useQueueSettingsStore().batchCount = count
    },

    disableAutoQueue() {
      useQueueSettingsStore().mode = 'disabled'
    },

    guard(check: () => boolean | Promise<boolean>) {
      guards.add(check)
      return () => guards.delete(check)
    }
  })
}
