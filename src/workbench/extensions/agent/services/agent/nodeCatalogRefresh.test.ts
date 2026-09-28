import { describe, expect, it, vi } from 'vitest'

import { refreshNodeCatalogOnRestart } from './nodeCatalogRefresh'

function fakeEvents() {
  const listeners = new Set<(raw: unknown) => void>()
  return {
    subscribe(listener: (raw: unknown) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(raw: unknown) {
      listeners.forEach((listener) => listener(raw))
    },
    get listenerCount() {
      return listeners.size
    }
  }
}

function toolCall(
  toolName: string,
  status: 'running' | 'success' | 'error',
  callId = 'call-1'
) {
  return {
    type: 'agent_tool_call',
    data: {
      tool_call_id: callId,
      tool_name: toolName,
      status,
      message_id: 'm',
      thread_id: 't'
    }
  }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function setup() {
  const events = fakeEvents()
  const order: string[] = []
  const deps = {
    refreshNodeDefinitions: vi.fn(async () => {
      order.push('refresh')
    }),
    reloadCurrentWorkflow: vi.fn(async () => {
      order.push('reload')
    }),
    onFailure: vi.fn()
  }
  const stop = refreshNodeCatalogOnRestart(events, deps)
  return { events, deps, order, stop }
}

describe('refreshNodeCatalogOnRestart', () => {
  it('re-registers node types, then rebuilds the open workflow, after a restart succeeds', async () => {
    const { events, order } = setup()
    events.emit(toolCall('restart_comfyui', 'success'))
    await flush()
    expect(order).toEqual(['refresh', 'reload'])
  })

  it('ignores a restart still running or one that failed, and other tools', async () => {
    const { events, deps } = setup()
    events.emit(toolCall('restart_comfyui', 'running'))
    events.emit(toolCall('restart_comfyui', 'error'))
    events.emit(toolCall('write', 'success'))
    events.emit({ type: 'agent_message_delta', data: {} })
    await flush()
    expect(deps.refreshNodeDefinitions).not.toHaveBeenCalled()
  })

  it('refreshes once per restart even when the event is delivered again', async () => {
    const { events, deps } = setup()
    events.emit(toolCall('restart_comfyui', 'success', 'a'))
    events.emit(toolCall('restart_comfyui', 'success', 'a'))
    events.emit(toolCall('restart_comfyui', 'success', 'b'))
    await flush()
    expect(deps.refreshNodeDefinitions).toHaveBeenCalledTimes(2)
  })

  it('reports a failed refresh and keeps handling later restarts', async () => {
    const { events, deps } = setup()
    deps.refreshNodeDefinitions.mockRejectedValueOnce(new Error('offline'))
    events.emit(toolCall('restart_comfyui', 'success', 'a'))
    await flush()
    expect(deps.onFailure).toHaveBeenCalledWith(new Error('offline'))
    expect(deps.reloadCurrentWorkflow).not.toHaveBeenCalled()
    events.emit(toolCall('restart_comfyui', 'success', 'b'))
    await flush()
    expect(deps.reloadCurrentWorkflow).toHaveBeenCalledTimes(1)
  })

  it('stops listening when unsubscribed', () => {
    const { events, stop } = setup()
    stop()
    expect(events.listenerCount).toBe(0)
  })
})
