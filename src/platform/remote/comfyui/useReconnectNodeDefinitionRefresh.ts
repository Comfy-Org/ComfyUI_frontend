import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { forEachNode } from '@/utils/graphTraversalUtil'

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

// A node whose type was unknown when the graph loaded is a placeholder that
// keeps its saved data in `last_serialization`.
function canvasHasRebuildablePlaceholder(): boolean {
  let found = false
  forEachNode(app.rootGraph, (node) => {
    if (found || node.last_serialization === undefined) return
    if (isRegistered(node.type)) found = true
  })
  return found
}

/**
 * Returns the `reconnected` handler that loads node types a restarted local
 * ComfyUI added, and rebuilds the open workflow's missing nodes from them.
 */
export function useReconnectNodeDefinitionRefresh() {
  if (isCloud) return async () => {}

  let inFlight: Promise<void> | null = null
  let reconnects = 0

  async function refreshIfServerGainedNodeTypes(): Promise<void> {
    const serverTypes = await fetchServerNodeTypes()
    if (!serverTypes?.some((type) => !isRegistered(type))) return
    await useCommandStore().execute('Comfy.RefreshNodeDefinitions', {
      errorHandler: (error) => {
        throw error
      }
    })
    const workflowStore = useWorkflowStore()
    const workflow = workflowStore.activeWorkflow
    if (!workflow || !canvasHasRebuildablePlaceholder()) return
    // Reload the workflow that was checked, not whichever one a queued load
    // makes active first.
    await useWorkflowService().openWorkflow(workflow, {
      force: true,
      isCurrent: () => workflowStore.activeWorkflow === workflow
    })
  }

  async function refreshUntilSettled(): Promise<void> {
    let handled: number
    do {
      handled = reconnects
      try {
        await refreshIfServerGainedNodeTypes()
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
