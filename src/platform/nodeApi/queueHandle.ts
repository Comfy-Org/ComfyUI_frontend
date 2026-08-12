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
import { api } from '@/scripts/api'
import { toNodeId } from '@/types/nodeId'
import { getExecutionIdsForSelectedNodes } from '@/utils/graphTraversalUtil'
import type { LGraph } from '@/lib/litegraph/src/litegraph'

import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
import type { Unsubscribe } from './widgetHandle'

interface RunOptions {
  /**
   * Run only these nodes and whatever feeds them, instead of the whole
   * workflow. Empty is rejected rather than treated as "everything": a filter
   * that matched nothing must not silently run the entire graph.
   */
  nodes?: readonly NodeHandle[]
  /** How many times to run. Defaults to 1. */
  batch?: number
}

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
  onBeforeRun(listener: () => void): Unsubscribe
  /**
   * A run was submitted. This is `afterQueued` — for advancing state that
   * should differ on the next run.
   */
  onAfterRun(listener: () => void): Unsubscribe
}

function subscribe(event: 'promptQueueing' | 'promptQueued') {
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

export function createQueueApi(
  getGraph: () => LGraph | null | undefined
): QueueHandle {
  return Object.freeze({
    async run({ nodes, batch = 1 }: RunOptions = {}) {
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

    onBeforeRun: subscribe('promptQueueing'),
    onAfterRun: subscribe('promptQueued')
  })
}
