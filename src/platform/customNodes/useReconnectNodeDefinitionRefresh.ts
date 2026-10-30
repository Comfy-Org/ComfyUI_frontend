import { delay } from 'es-toolkit'
import { getCurrentScope } from 'vue'
import type { ComputedRef } from 'vue'

import { LiteGraph } from '@comfyorg/litegraph/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { forEachNode } from '@comfyorg/litegraph/utils/graphTraversalUtil'

import { useUserBusy } from './useUserBusy'

const IDLE_POLL_MS = 100
const IDLE_TIMEOUT_MS = 30_000

async function fetchServerNodeTypes(): Promise<string[] | undefined> {
  try {
    const fetched = await app.fetchNodeDefs()
    return fetched.ok ? Object.keys(fetched.defs) : undefined
  } catch {
    return undefined
  }
}

function isRegistered(type: string): boolean {
  return (
    type in useNodeDefStore().nodeDefsByName ||
    type in LiteGraph.registered_node_types
  )
}

function canvasHasRebuildablePlaceholder(): boolean {
  let found = false
  forEachNode(app.rootGraph, (node) => {
    if (found || node.last_serialization === undefined) return
    if (isRegistered(node.type)) found = true
  })
  return found
}

async function rebuildWhenIdle(
  workflow: LoadedComfyWorkflow,
  userBusy: ComputedRef<boolean>,
  isDisposed: () => boolean
): Promise<void> {
  const workflowStore = useWorkflowStore()
  const isActive = () =>
    !isDisposed() && workflowStore.activeWorkflow === workflow
  const isIdle = () =>
    workflow.changeTracker.changeCount === 0 &&
    !workflow.changeTracker._restoringState &&
    !userBusy.value
  const deadline = Date.now() + IDLE_TIMEOUT_MS
  while (isActive() && canvasHasRebuildablePlaceholder()) {
    if (isIdle()) {
      const attempt = { deferred: false }
      const rebuilt = await useWorkflowService().openWorkflow(workflow, {
        force: true,
        isCurrent: () => {
          attempt.deferred = !(isActive() && isIdle())
          return !attempt.deferred
        },
        keepSavedBaseline: true
      })
      if (rebuilt || !attempt.deferred) return
    }
    if (Date.now() >= deadline) return
    await delay(IDLE_POLL_MS)
  }
}

/**
 * Returns the `reconnected` handler that loads node types a restarted local
 * ComfyUI added, and rebuilds the open workflow's missing nodes from them.
 */
export function useReconnectNodeDefinitionRefresh() {
  if (isCloud) return async () => {}

  const userBusy = useUserBusy()
  const scope = getCurrentScope()
  const isDisposed = () => scope?.active === false
  let inFlight: Promise<void> | null = null
  let reconnects = 0

  async function refreshAndRebuild(): Promise<void> {
    if (isDisposed()) return
    const serverTypes = await fetchServerNodeTypes()
    if (!serverTypes || isDisposed()) return
    if (serverTypes.some((type) => !isRegistered(type))) {
      await useCommandStore().execute('Comfy.RefreshNodeDefinitions', {
        errorHandler: (error) => {
          throw error
        }
      })
    }
    if (isDisposed()) return
    const workflow = useWorkflowStore().activeWorkflow
    if (workflow) await rebuildWhenIdle(workflow, userBusy, isDisposed)
  }

  async function refreshUntilSettled(): Promise<void> {
    let handled: number
    do {
      handled = reconnects
      try {
        await refreshAndRebuild()
      } catch (error) {
        reportError(error, {
          surface: 'graph',
          errorType: 'failure_refreshing_node_definitions_after_reconnect',
          level: 'warning'
        })
      }
    } while (handled !== reconnects)
  }

  return async function refreshNodeDefinitionsOnReconnect(): Promise<void> {
    reconnects += 1
    if (inFlight) return inFlight
    inFlight = refreshUntilSettled().finally(() => {
      inFlight = null
    })
    return inFlight
  }
}
