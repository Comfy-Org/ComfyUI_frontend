import { fromPartial } from '@total-typescript/shoehorn'
import { useEventListener } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useServerLogs } from '@/composables/useServerLogs'
import type { LogsWsMessage } from '@/schemas/apiSchema'
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
  const listenerFor = <T>(eventType: string) =>
    vi
      .mocked(useEventListener)
      .mock.calls.find(([, type]) => type === eventType)?.[2] as
      | ((event: CustomEvent<T>) => void)
      | undefined

  beforeEach(() => {
    vi.clearAllMocks()
  })

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

    expect(vi.mocked(useEventListener)).toHaveBeenCalledWith(
      api,
      'logs',
      expect.any(Function)
    )
  })

  it('should handle log messages correctly', async () => {
    const { logs, startListening } = useServerLogs()

    await startListening()

    // Get the callback that was registered with useEventListener
    const eventCallback = vi.mocked(useEventListener).mock.calls[0][2] as (
      event: CustomEvent<LogsWsMessage>
    ) => void

    // Simulate receiving a log event
    const mockEvent = new CustomEvent('logs', {
      detail: fromPartial<LogsWsMessage>({
        entries: [{ m: 'Log message 1' }, { m: 'Log message 2' }]
      })
    }) as CustomEvent<LogsWsMessage>

    eventCallback(mockEvent)
    await nextTick()

    expect(logs.value).toEqual(['Log message 1', 'Log message 2'])
  })

  it('should use the message filter if provided', async () => {
    const { logs, startListening } = useServerLogs({
      messageFilter: (msg) => msg !== 'remove me'
    })

    await startListening()

    const eventCallback = vi.mocked(useEventListener).mock.calls[0][2] as (
      event: CustomEvent<LogsWsMessage>
    ) => void

    const mockEvent = new CustomEvent('logs', {
      detail: fromPartial<LogsWsMessage>({
        entries: [
          { m: 'Log message 1 dont remove me' },
          { m: 'remove me' },
          { m: '' }
        ]
      })
    }) as CustomEvent<LogsWsMessage>

    eventCallback(mockEvent)
    await nextTick()

    expect(logs.value).toEqual(['Log message 1 dont remove me', ''])
  })

  it('only captures logs while the matching task is active', async () => {
    const { logs, startListening } = useServerLogs({ ui_id: 'task-1' })

    await startListening()

    expect(vi.mocked(useEventListener)).toHaveBeenCalledWith(
      api,
      'cm-task-started',
      expect.any(Function)
    )
    expect(vi.mocked(useEventListener)).toHaveBeenCalledWith(
      api,
      'cm-task-completed',
      expect.any(Function)
    )

    const onLogs = listenerFor<LogsWsMessage>('logs')
    const onTaskStarted = listenerFor<{ ui_id: string }>('cm-task-started')
    const onTaskDone = listenerFor<{ ui_id: string }>('cm-task-completed')

    onLogs?.(
      new CustomEvent('logs', {
        detail: fromPartial<LogsWsMessage>({
          entries: [{ m: 'before start' }]
        })
      })
    )
    onTaskStarted?.(
      new CustomEvent('cm-task-started', { detail: { ui_id: 'other-task' } })
    )
    onLogs?.(
      new CustomEvent('logs', {
        detail: fromPartial<LogsWsMessage>({
          entries: [{ m: 'wrong task' }]
        })
      })
    )
    onTaskStarted?.(
      new CustomEvent('cm-task-started', { detail: { ui_id: 'task-1' } })
    )
    onLogs?.(
      new CustomEvent('logs', {
        detail: fromPartial<LogsWsMessage>({
          entries: [{ m: 'captured' }]
        })
      })
    )
    onTaskDone?.(
      new CustomEvent('cm-task-completed', { detail: { ui_id: 'other-task' } })
    )
    onLogs?.(
      new CustomEvent('logs', {
        detail: fromPartial<LogsWsMessage>({
          entries: [{ m: 'still active' }]
        })
      })
    )
    onTaskDone?.(
      new CustomEvent('cm-task-completed', { detail: { ui_id: 'task-1' } })
    )
    onLogs?.(
      new CustomEvent('logs', {
        detail: fromPartial<LogsWsMessage>({
          entries: [{ m: 'after done' }]
        })
      })
    )

    expect(logs.value).toEqual(['captured', 'still active'])
  })

  it('ignores invalid and empty log events', async () => {
    const { logs, startListening } = useServerLogs()

    await startListening()

    const onLogs = listenerFor<LogsWsMessage>('logs')

    onLogs?.(
      new CustomEvent('not-logs', {
        detail: fromPartial<LogsWsMessage>({
          entries: [{ m: 'wrong event' }]
        })
      })
    )
    onLogs?.(
      new CustomEvent('logs', {
        detail: fromPartial<LogsWsMessage>({
          entries: []
        })
      })
    )
    onLogs?.(
      new CustomEvent('logs', {
        detail: fromPartial<LogsWsMessage>({
          entries: [{ m: ' ' }]
        })
      })
    )

    expect(logs.value).toEqual([])
  })

  it('stops every registered listener', async () => {
    const stopLogs = vi.fn()
    const stopTaskStarted = vi.fn()
    const stopTaskDone = vi.fn()
    vi.mocked(useEventListener)
      .mockReturnValueOnce(stopLogs)
      .mockReturnValueOnce(stopTaskStarted)
      .mockReturnValueOnce(stopTaskDone)

    const { startListening, stopListening } = useServerLogs({ ui_id: 'task-1' })

    await startListening()
    await stopListening()

    expect(stopLogs).toHaveBeenCalledTimes(1)
    expect(stopTaskStarted).toHaveBeenCalledTimes(1)
    expect(stopTaskDone).toHaveBeenCalledTimes(1)
    expect(api.subscribeLogs).toHaveBeenLastCalledWith(false)
  })
})
