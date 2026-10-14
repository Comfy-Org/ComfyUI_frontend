import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'

import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'

import { parseAgentWsEvent } from '../../schemas/agentApiSchema'

function isSuccessfulRestart(raw: unknown): boolean {
  const parsed = parseAgentWsEvent(raw)
  return (
    parsed.success &&
    parsed.data.type === 'agent_tool_call' &&
    parsed.data.data.tool_name === 'restart_comfyui' &&
    parsed.data.data.status === 'success'
  )
}

async function refreshNodeDefinitions(): Promise<boolean> {
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
      errorType: 'failure_refreshing_node_definitions_after_agent_restart',
      level: 'warning'
    })
    return false
  }
}

async function reloadWorkflowReportedByLoadQueue(): Promise<void> {
  await useWorkflowService()
    .reloadCurrentWorkflow()
    .catch(() => undefined)
}

/**
 * Refreshes node definitions and the open workflow after the agent restarts
 * ComfyUI; a failed refresh runs again on ComfyUI's next reconnect.
 */
export const useAgentNodeDefinitionRefreshStore = defineStore(
  'agentNodeDefinitionRefresh',
  () => {
    let stale = false
    let queue = Promise.resolve()

    async function refreshIfStale(): Promise<void> {
      if (!stale) return
      stale = false
      if (!(await refreshNodeDefinitions())) {
        stale = true
        return
      }
      await reloadWorkflowReportedByLoadQueue()
    }

    function enqueueRefresh(): void {
      queue = queue.then(refreshIfStale)
    }

    function observeAgentEvent(raw: unknown): void {
      if (!isSuccessfulRestart(raw)) return
      stale = true
      enqueueRefresh()
    }

    useEventListener(api, 'reconnected', enqueueRefresh)

    return { observeAgentEvent }
  }
)
