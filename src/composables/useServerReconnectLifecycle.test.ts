import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import { useReconnectingNotification } from '@/composables/useReconnectingNotification'
import { useServerReconnectLifecycle } from '@/composables/useServerReconnectLifecycle'
import { useReconnectNodeDefinitionRefresh } from '@/platform/customNodes/useReconnectNodeDefinitionRefresh'
import { api } from '@/scripts/api'
import { reportError } from '@comfyorg/telemetry/reportError'

vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'))

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
  const onRevokedSocketEnded = vi.fn()
  return {
    useReconnectingNotification: () => ({
      onReconnected,
      onReconnecting,
      onRevokedSocketEnded
    })
  }
})

function startLifecycle() {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  scope.run(() => useServerReconnectLifecycle())
  return scope
}

describe('useServerReconnectLifecycle', () => {
  it('shows the reconnecting notification when the socket drops', () => {
    startLifecycle()

    api.dispatchCustomEvent('reconnecting')

    expect(useReconnectingNotification().onReconnecting).toHaveBeenCalledOnce()
    expect(useReconnectQueueRefresh()).not.toHaveBeenCalled()
    expect(useReconnectNodeDefinitionRefresh()).not.toHaveBeenCalled()
  })

  it('runs every reconnect consumer once when the server comes back', () => {
    startLifecycle()

    api.dispatchCustomEvent('reconnected')

    expect(useReconnectingNotification().onReconnected).toHaveBeenCalledOnce()
    expect(useReconnectQueueRefresh()).toHaveBeenCalledOnce()
    expect(useReconnectNodeDefinitionRefresh()).toHaveBeenCalledOnce()
  })

  it('shows the access-lost notification when the server revokes the socket', () => {
    startLifecycle()

    api.dispatchCustomEvent('revokedSocketEnded')

    expect(
      useReconnectingNotification().onRevokedSocketEnded
    ).toHaveBeenCalledOnce()
    expect(useReconnectQueueRefresh()).not.toHaveBeenCalled()
  })

  it('refreshes the queue even while the node definition refresh is still running', () => {
    vi.mocked(useReconnectNodeDefinitionRefresh()).mockReturnValueOnce(
      new Promise(() => {})
    )
    startLifecycle()

    api.dispatchCustomEvent('reconnected')

    expect(useReconnectQueueRefresh()).toHaveBeenCalledOnce()
  })

  it('reports a failed queue refresh', async () => {
    const failure = new Error('queue refresh failed')
    vi.mocked(useReconnectQueueRefresh()).mockRejectedValueOnce(failure)
    startLifecycle()

    api.dispatchCustomEvent('reconnected')
    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({
          errorType: 'failure_refreshing_queue_after_reconnect'
        })
      )
    )
  })

  it('stops listening when its scope is disposed', () => {
    startLifecycle().stop()

    api.dispatchCustomEvent('reconnecting')
    api.dispatchCustomEvent('reconnected')

    expect(useReconnectingNotification().onReconnecting).not.toHaveBeenCalled()
    expect(useReconnectingNotification().onReconnected).not.toHaveBeenCalled()
    expect(useReconnectQueueRefresh()).not.toHaveBeenCalled()
    expect(useReconnectNodeDefinitionRefresh()).not.toHaveBeenCalled()
  })
})
