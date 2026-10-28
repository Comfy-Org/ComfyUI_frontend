import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'

import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

function isSuccessfulRestart(event: AgentWsEvent): boolean {
  return (
    event.type === 'agent_tool_call' &&
    event.data.tool_name === 'restart_comfyui' &&
    event.data.status === 'success'
  )
}

function isSuccessfulCatalogRefresh(event: AgentWsEvent): boolean {
  return (
    event.type === 'agent_tool_call' &&
    event.data.tool_name === 'refresh_catalog' &&
    event.data.status === 'success'
  )
}

type NodeDefinitionRefreshErrorType =
  | 'failure_refreshing_node_definitions_after_agent_restart'
  | 'failure_refreshing_node_definitions_after_agent_catalog_refresh'

async function refreshNodeDefinitions(
  errorType: NodeDefinitionRefreshErrorType
): Promise<boolean> {
  try {
    await useCommandStore().execute('Comfy.RefreshNodeDefinitions', {
      errorHandler: (error) => {
        throw error
      }
    })
    return true
  } catch (error) {
    reportError(error, {
      surface: 'agent',
      errorType,
      level: 'warning'
    })
    return false
  }
}

async function reloadWorkflowWithoutRejecting(): Promise<void> {
  await useWorkflowService()
    .reloadCurrentWorkflow()
    .catch(() => undefined)
}

/**
 * How far apart a successful restart and a ComfyUI `/ws` reconnect may be for
 * the reconnect to count as that restart. The turn can run on after the tool
 * reports success, and the agent then allows ComfyUI five minutes to go down
 * and come back.
 */
const RESTART_WINDOW_MS = 10 * 60_000

/**
 * Refreshes node definitions and the open workflow when ComfyUI reconnects
 * after the agent restarts it. The agent reports the restart before ComfyUI
 * goes down, but the report and the reconnect arrive on different sockets, so
 * either may come first: every reconnect within the window refreshes,
 * including one that came just before the report. An unrelated reconnect in
 * the window refreshes too, which is harmless, and leaves the restart's own
 * reconnect to refresh again.
 */
export const useAgentNodeDefinitionRefreshStore = defineStore(
  'agentNodeDefinitionRefresh',
  () => {
    let restartedAt = -Infinity
    let reconnectedAt = -Infinity
    let refreshQueued = false
    let catalogRefreshQueued = false
    let queue = Promise.resolve()

    async function refresh(): Promise<void> {
      refreshQueued = false
      if (
        await refreshNodeDefinitions(
          'failure_refreshing_node_definitions_after_agent_restart'
        )
      ) {
        await reloadWorkflowWithoutRejecting()
      }
    }

    async function refreshCatalog(): Promise<void> {
      catalogRefreshQueued = false
      await refreshNodeDefinitions(
        'failure_refreshing_node_definitions_after_agent_catalog_refresh'
      )
    }

    function enqueueRefresh(): void {
      if (refreshQueued) return
      refreshQueued = true
      queue = queue.then(refresh).catch((error: unknown) => {
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_running_agent_node_definition_refresh'
        })
      })
    }

    function enqueueCatalogRefresh(): void {
      if (catalogRefreshQueued) return
      catalogRefreshQueued = true
      queue = queue.then(refreshCatalog).catch((error: unknown) => {
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_running_agent_node_definition_refresh'
        })
      })
    }

    function refreshIfRestartNearby(): void {
      if (Math.abs(reconnectedAt - restartedAt) <= RESTART_WINDOW_MS) {
        enqueueRefresh()
      }
    }

    function observeAgentEvent(event: AgentWsEvent): void {
      if (isSuccessfulCatalogRefresh(event)) {
        enqueueCatalogRefresh()
        return
      }
      if (!isSuccessfulRestart(event)) return
      restartedAt = Date.now()
      refreshIfRestartNearby()
    }

    useEventListener(api, 'reconnected', () => {
      reconnectedAt = Date.now()
      refreshIfRestartNearby()
    })

    return { observeAgentEvent }
  }
)
