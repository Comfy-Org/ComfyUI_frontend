import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'

import { useAgentNodeDefinitionRefreshStore } from './agentNodeDefinitionRefreshStore'

vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))

function toolCall(toolName: string, status: 'running' | 'success' | 'error') {
  return {
    type: 'agent_tool_call',
    data: {
      tool_call_id: 'call-1',
      tool_name: toolName,
      status,
      message_id: 'm',
      thread_id: 't'
    }
  }
}

const restartSucceeded = toolCall('restart_comfyui', 'success')

function registerRefreshCommand(
  refresh = vi.fn<() => Promise<void>>(async () => {})
) {
  useCommandStore().registerCommand({
    id: 'Comfy.RefreshNodeDefinitions',
    function: refresh
  })
  return refresh
}

describe('agentNodeDefinitionRefreshStore', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  it('refreshes node definitions before reloading the open workflow after a restart succeeds', async () => {
    const order: string[] = []
    registerRefreshCommand(
      vi.fn(async () => {
        order.push('refresh')
      })
    )
    vi.mocked(useWorkflowService().reloadCurrentWorkflow).mockImplementation(
      async () => {
        order.push('reload')
      }
    )

    useAgentNodeDefinitionRefreshStore().observeAgentEvent(restartSucceeded)
    await vi.advanceTimersByTimeAsync(0)

    expect(order).toEqual(['refresh', 'reload'])
  })

  it.for([
    {
      name: 'a restart still running',
      raw: toolCall('restart_comfyui', 'running')
    },
    {
      name: 'a restart that failed',
      raw: toolCall('restart_comfyui', 'error')
    },
    { name: 'another tool succeeding', raw: toolCall('write', 'success') },
    {
      name: 'a frame that is not a tool call',
      raw: { type: 'agent_message_delta', data: {} }
    }
  ])('ignores $name', async ({ raw }) => {
    const refresh = registerRefreshCommand()

    useAgentNodeDefinitionRefreshStore().observeAgentEvent(raw)
    await vi.advanceTimersByTimeAsync(0)

    expect(refresh).not.toHaveBeenCalled()
  })

  it.for([
    {
      origin: 'the refresh command fails',
      arrange: () =>
        registerRefreshCommand(
          vi.fn<() => Promise<void>>().mockRejectedValue(new Error('down'))
        )
    },
    { origin: 'the refresh command is not registered', arrange: () => {} }
  ])(
    'reports once and keeps the workflow when $origin',
    async ({ arrange }) => {
      arrange()

      useAgentNodeDefinitionRefreshStore().observeAgentEvent(restartSucceeded)
      await vi.advanceTimersByTimeAsync(0)

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_refreshing_node_definitions_after_agent_restart'
        })
      )
      expect(useWorkflowService().reloadCurrentWorkflow).not.toHaveBeenCalled()
    }
  )

  it('refreshes again when ComfyUI reconnects after a failed refresh', async () => {
    const refresh = registerRefreshCommand(
      vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValue(undefined)
    )
    useAgentNodeDefinitionRefreshStore().observeAgentEvent(restartSucceeded)
    await vi.advanceTimersByTimeAsync(0)

    api.dispatchCustomEvent('reconnected')
    await vi.advanceTimersByTimeAsync(0)

    expect(refresh).toHaveBeenCalledTimes(2)
    expect(useWorkflowService().reloadCurrentWorkflow).toHaveBeenCalledOnce()
  })

  it('does not refresh on a ComfyUI reconnect when no restart was seen', async () => {
    const refresh = registerRefreshCommand()
    useAgentNodeDefinitionRefreshStore()

    api.dispatchCustomEvent('reconnected')
    await vi.advanceTimersByTimeAsync(0)

    expect(refresh).not.toHaveBeenCalled()
  })

  it('does not refresh on a ComfyUI reconnect once the last restart refreshed', async () => {
    const refresh = registerRefreshCommand()
    useAgentNodeDefinitionRefreshStore().observeAgentEvent(restartSucceeded)
    await vi.advanceTimersByTimeAsync(0)

    api.dispatchCustomEvent('reconnected')
    await vi.advanceTimersByTimeAsync(0)

    expect(refresh).toHaveBeenCalledOnce()
  })

  it('runs one more refresh for restarts that arrive while a refresh is in flight', async () => {
    let finishFirstRefresh: () => void = () => undefined
    const refresh = registerRefreshCommand(
      vi
        .fn<() => Promise<void>>()
        .mockReturnValueOnce(
          new Promise<void>((resolve) => {
            finishFirstRefresh = resolve
          })
        )
        .mockResolvedValue(undefined)
    )
    const store = useAgentNodeDefinitionRefreshStore()
    store.observeAgentEvent(restartSucceeded)
    await vi.advanceTimersByTimeAsync(0)

    store.observeAgentEvent(restartSucceeded)
    store.observeAgentEvent(restartSucceeded)
    finishFirstRefresh()
    await vi.advanceTimersByTimeAsync(0)

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('keeps refreshing later restarts after a workflow reload rejects', async () => {
    const refresh = registerRefreshCommand()
    vi.mocked(useWorkflowService().reloadCurrentWorkflow).mockRejectedValueOnce(
      new Error('load failed')
    )
    const store = useAgentNodeDefinitionRefreshStore()
    store.observeAgentEvent(restartSucceeded)
    await vi.advanceTimersByTimeAsync(0)

    store.observeAgentEvent(restartSucceeded)
    await vi.advanceTimersByTimeAsync(0)

    expect(refresh).toHaveBeenCalledTimes(2)
    expect(reportError).not.toHaveBeenCalled()
  })
})
