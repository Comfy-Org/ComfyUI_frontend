import { delay } from 'es-toolkit'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { forEachNode } from '@/utils/graphTraversalUtil'

const CHANGE_SETTLE_POLL_MS = 100
const CHANGE_SETTLE_TIMEOUT_MS = 30_000

async function fetchServerNodeTypes(): Promise<string[] | undefined> {
  try {
    const response = await api.fetchNodeDefs()
    if (!response.ok) return undefined
    const defs: Record<string, ComfyNodeDef> = await response.json()
    return Object.keys(defs)
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

async function changesSettled(workflow: LoadedComfyWorkflow): Promise<boolean> {
  const deadline = Date.now() + CHANGE_SETTLE_TIMEOUT_MS
  while (workflow.changeTracker.changeCount > 0) {
    if (Date.now() >= deadline) return false
    await delay(CHANGE_SETTLE_POLL_MS)
  }
  return true
}

async function rebuildWorkflow(workflow: LoadedComfyWorkflow): Promise<void> {
  const workflowStore = useWorkflowStore()
  const baseline = workflow.changeTracker.initialState
  const wasModified = workflow.isModified
  const reloaded = await useWorkflowService().openWorkflow(workflow, {
    force: true,
    isCurrent: () => workflowStore.activeWorkflow === workflow
  })
  if (!reloaded) return
  workflow.changeTracker.initialState = baseline
  workflow.isModified = wasModified
}

/**
 * Returns the `reconnected` handler that loads node types a restarted local
 * ComfyUI added, and rebuilds the open workflow's missing nodes from them.
 */
export function useReconnectNodeDefinitionRefresh() {
  if (isCloud) return async () => {}

  let inFlight: Promise<void> | null = null
  let reconnects = 0

  async function refreshAndRebuild(): Promise<void> {
    const serverTypes = await fetchServerNodeTypes()
    if (!serverTypes) return
    if (serverTypes.some((type) => !isRegistered(type))) {
      await useCommandStore().execute('Comfy.RefreshNodeDefinitions', {
        errorHandler: (error) => {
          throw error
        }
      })
    }
    const workflow = useWorkflowStore().activeWorkflow
    if (!workflow || !canvasHasRebuildablePlaceholder()) return
    if (!(await changesSettled(workflow))) return
    if (useWorkflowStore().activeWorkflow !== workflow) return
    await rebuildWorkflow(workflow)
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
