import { useEventListener } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useServerLogs } from '@/composables/useServerLogs'
import { LogsWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

vi.mock('@/scripts/api', () => ({
  api: {
    subscribeLogs: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

vi.mock('@vueuse/core', () => ({
  useEventListener: vi.fn().mockReturnValue(vi.fn())
}))

describe('useServerLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with empty logs array', () => {
    const { logs } = useServerLogs({ ui_id: 'test-ui-id' })
    expect(logs.value).toEqual([])
  })

  it('should not subscribe to logs by default', () => {
    useServerLogs({ ui_id: 'test-ui-id' })
    expect(api.subscribeLogs).not.toHaveBeenCalled()
  })

  it('should subscribe to logs when immediate is true', () => {
    useServerLogs({ ui_id: 'test-ui-id', immediate: true })
    expect(api.subscribeLogs).toHaveBeenCalledWith(true)
  })

  it('should start listening when startListening is called', async () => {
    const { startListening } = useServerLogs({ ui_id: 'test-ui-id' })

    await startListening()

    expect(api.subscribeLogs).toHaveBeenCalledWith(true)
  })

  it('should stop listening when stopListening is called', async () => {
    const { startListening, stopListening } = useServerLogs({
      ui_id: 'test-ui-id'
    })

    await startListening()
    await stopListening()

    // TODO: Update this test when subscribeLogs(false) is re-enabled
    // Currently commented out in useServerLogs to prevent logs from stopping
    // after 1st of multiple queue tasks
    expect(api.subscribeLogs).toHaveBeenCalledWith(true)
  })

  it('should register event listener when starting', async () => {
    const { startListening } = useServerLogs({ ui_id: 'test-ui-id' })

    await startListening()

    expect(vi.mocked(useEventListener)).toHaveBeenCalledWith(
      api,
      'logs',
      expect.any(Function)
    )
  })

  it('should handle log messages correctly', async () => {
    const { logs, startListening } = useServerLogs({ ui_id: 'test-ui-id' })

    await startListening()

    // Get the callbacks that were registered with useEventListener
    const mockCalls = vi.mocked(useEventListener).mock.calls
    const logsCallback = mockCalls.find((call) => call[1] === 'logs')?.[2] as (
      event: CustomEvent<LogsWsMessage>
    ) => void
    const taskStartedCallback = mockCalls.find(
      (call) => call[1] === 'cm-task-started'
    )?.[2] as (event: CustomEvent<any>) => void

    // First, simulate task started event
    const taskStartedEvent = new CustomEvent('cm-task-started', {
      detail: {
        type: 'cm-task-started',
        ui_id: 'test-ui-id'
      }
    })
    taskStartedCallback(taskStartedEvent)
    await nextTick()

    // Now simulate receiving a log event
    const mockEvent = new CustomEvent('logs', {
      detail: {
        type: 'logs',
        entries: [{ m: 'Log message 1' }, { m: 'Log message 2' }]
      } as unknown as LogsWsMessage
    }) as CustomEvent<LogsWsMessage>

    logsCallback(mockEvent)
    await nextTick()

    expect(logs.value).toEqual(['Log message 1', 'Log message 2'])
  })

  it('should use the message filter if provided', async () => {
    const { logs, startListening } = useServerLogs({
      ui_id: 'test-ui-id',
      messageFilter: (msg) => msg !== 'remove me'
    })

    await startListening()

    // Get the callbacks that were registered with useEventListener
    const mockCalls = vi.mocked(useEventListener).mock.calls
    const logsCallback = mockCalls.find((call) => call[1] === 'logs')?.[2] as (
      event: CustomEvent<LogsWsMessage>
    ) => void
    const taskStartedCallback = mockCalls.find(
      (call) => call[1] === 'cm-task-started'
    )?.[2] as (event: CustomEvent<any>) => void

    // First, simulate task started event
    const taskStartedEvent = new CustomEvent('cm-task-started', {
      detail: {
        type: 'cm-task-started',
        ui_id: 'test-ui-id'
      }
    })
    taskStartedCallback(taskStartedEvent)
    await nextTick()

    // Now simulate receiving a log event
    const mockEvent = new CustomEvent('logs', {
      detail: {
        type: 'logs',
        entries: [
          { m: 'Log message 1 dont remove me' },
          { m: 'remove me' },
          { m: '' }
        ]
      } as unknown as LogsWsMessage
    }) as CustomEvent<LogsWsMessage>

    logsCallback(mockEvent)
    await nextTick()

    expect(logs.value).toEqual(['Log message 1 dont remove me', ''])
  })
})
