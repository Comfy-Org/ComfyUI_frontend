import { useEventListener } from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useServerLogs } from '@/composables/useServerLogs'
import type { LogsWsMessage } from '@/platform/remote/comfyui/execution/types'
import { api } from '@/scripts/api'

vi.mock(import('@/scripts/api'))

vi.mock(import('@vueuse/core'), { spy: true })

describe('useServerLogs', () => {
  it('should initialize with empty logs array', () => {
    const { logs } = useServerLogs()
    expect(logs.value).toEqual([])
  })

  it('should not subscribe to logs by default', () => {
    useServerLogs()
    expect(api.subscribeLogs).not.toHaveBeenCalled()
  })

  it('should subscribe to logs when immediate is true', () => {
    useServerLogs({ immediate: true })
    expect(api.subscribeLogs).toHaveBeenCalledWith(true)
  })

  it('should start listening when startListening is called', async () => {
    const { startListening } = useServerLogs()

    await startListening()

    expect(api.subscribeLogs).toHaveBeenCalledWith(true)
  })

  it('should stop listening when stopListening is called', async () => {
    const { startListening, stopListening } = useServerLogs()

    await startListening()
    await stopListening()

    expect(api.subscribeLogs).toHaveBeenCalledWith(false)
  })

  it('should register event listener when starting', async () => {
    const { startListening } = useServerLogs()

    await startListening()

    expect(useEventListener).toHaveBeenCalledWith(
      api,
      'logs',
      expect.any(Function)
    )
  })

  it('should handle log messages correctly', async () => {
    const { logs, startListening } = useServerLogs()

    await startListening()

    const message: LogsWsMessage = {
      entries: [
        { t: '00:00:00', m: 'Log message 1' },
        { t: '00:00:00', m: 'Log message 2' }
      ],
      size: { cols: 80, row: 24 }
    }

    api.dispatchCustomEvent('logs', message)
    await nextTick()

    expect(logs.value).toEqual(['Log message 1', 'Log message 2'])
  })

  it('should use the message filter if provided', async () => {
    const { logs, startListening } = useServerLogs({
      messageFilter: (msg) => msg !== 'remove me'
    })

    await startListening()

    const message: LogsWsMessage = {
      entries: [
        { t: '00:00:00', m: 'Log message 1 dont remove me' },
        { t: '00:00:00', m: 'remove me' },
        { t: '00:00:00', m: '' }
      ],
      size: { cols: 80, row: 24 }
    }

    api.dispatchCustomEvent('logs', message)
    await nextTick()

    expect(logs.value).toEqual(['Log message 1 dont remove me', ''])
  })
})
