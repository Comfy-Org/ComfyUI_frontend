import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { forEachNode } from '@/utils/graphTraversalUtil'

/** The server's node types, or undefined when it cannot answer yet. */
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

function canvasUsesAny(types: ReadonlySet<string>): boolean {
  let found = false
  forEachNode(app.rootGraph, (node) => {
    if (!found && types.has(node.type)) found = true
  })
  return found
}

/**
 * Returns the handler for the `reconnected` api event that picks up node
 * types a restarted ComfyUI now serves. Any restart counts: one the agent
 * panel never saw, `comfy launch` or `comfy stop`, a Desktop server restart.
 * When `/object_info` lists a type the page has not registered, it refreshes
 * node definitions; when the open workflow holds a node of that type, which
 * loaded as a missing node, it then reloads the workflow so the node is built
 * from its definition. A reconnect with no new types costs one `/object_info`
 * read and changes nothing. Cloud servers are not restarted this way, so the
 * handler does nothing there.
 */
export function useReconnectNodeDefinitionRefresh() {
  let inFlight: Promise<void> | null = null
  let reconnects = 0

  async function refreshIfServerGainedNodeTypes(): Promise<void> {
    const serverTypes = await fetchServerNodeTypes()
    if (!serverTypes) return
    const known = useNodeDefStore().nodeDefsByName
    const added = new Set(
      serverTypes.filter(
        (type) => !(type in known) && !(type in LiteGraph.registered_node_types)
      )
    )
    if (added.size === 0) return
    const reloadWorkflow = canvasUsesAny(added)
    await useCommandStore().execute('Comfy.RefreshNodeDefinitions', {
      errorHandler: (error) => {
        throw error
      }
    })
    if (reloadWorkflow) await useWorkflowService().reloadCurrentWorkflow()
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
    if (isCloud) return
    reconnects += 1
    if (inFlight) return inFlight
    inFlight = refreshUntilSettled().finally(() => {
      inFlight = null
    })
    return inFlight
  }
}
