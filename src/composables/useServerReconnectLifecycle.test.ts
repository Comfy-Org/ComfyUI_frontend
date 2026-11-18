import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import { useReconnectingNotification } from '@/composables/useReconnectingNotification'
import { useServerReconnectLifecycle } from '@/composables/useServerReconnectLifecycle'
import { useReconnectNodeDefinitionRefresh } from '@/platform/customNodes/useReconnectNodeDefinitionRefresh'
import { api } from '@/scripts/api'

vi.mock(import('@/scripts/api'), () => ({
  api: new EventTarget() as unknown as typeof api
}))

vi.mock(
  import('@/platform/customNodes/useReconnectNodeDefinitionRefresh'),
  () => {
    const refreshNodeDefinitionsOnReconnect = vi.fn(async () => {})
    return {
      useReconnectNodeDefinitionRefresh: () => refreshNodeDefinitionsOnReconnect
    }
  }
)

vi.mock(import('@/composables/useReconnectQueueRefresh'), () => {
  const refreshOnReconnect = vi.fn(async () => {})
  return { useReconnectQueueRefresh: () => refreshOnReconnect }
})

vi.mock(import('@/composables/useReconnectingNotification'), () => {
  const onReconnected = vi.fn()
  const onReconnecting = vi.fn()
  return {
    useReconnectingNotification: () => ({ onReconnected, onReconnecting })
  }
})

function dispatch(type: 'reconnecting' | 'reconnected') {
  ;(api as unknown as EventTarget).dispatchEvent(new CustomEvent(type))
}

function startLifecycle() {
  const scope = effectScope()
  scope.run(() => useServerReconnectLifecycle())
  return scope
}

describe('useServerReconnectLifecycle', () => {
  it('shows the reconnecting notification when the socket drops', () => {
    const scope = startLifecycle()

    dispatch('reconnecting')

    expect(useReconnectingNotification().onReconnecting).toHaveBeenCalledOnce()
    expect(useReconnectQueueRefresh()).not.toHaveBeenCalled()
    expect(useReconnectNodeDefinitionRefresh()).not.toHaveBeenCalled()
    scope.stop()
  })

  it('runs every reconnect consumer once when the server comes back', () => {
    const scope = startLifecycle()

    dispatch('reconnected')

    expect(useReconnectingNotification().onReconnected).toHaveBeenCalledOnce()
    expect(useReconnectQueueRefresh()).toHaveBeenCalledOnce()
    expect(useReconnectNodeDefinitionRefresh()).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('refreshes the queue even while the node definition refresh is still running', () => {
    vi.mocked(useReconnectNodeDefinitionRefresh()).mockReturnValueOnce(
      new Promise(() => {})
    )
    const scope = startLifecycle()

    dispatch('reconnected')

    expect(useReconnectQueueRefresh()).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('stops listening when its scope is disposed', () => {
    const scope = startLifecycle()
    scope.stop()

    dispatch('reconnecting')
    dispatch('reconnected')

    expect(useReconnectingNotification().onReconnecting).not.toHaveBeenCalled()
    expect(useReconnectingNotification().onReconnected).not.toHaveBeenCalled()
    expect(useReconnectQueueRefresh()).not.toHaveBeenCalled()
    expect(useReconnectNodeDefinitionRefresh()).not.toHaveBeenCalled()
  })
})
