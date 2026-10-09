import type { RequestPage, RequestStatus } from '@comfyorg/magic-patch-types'
import { describe, expect, it, vi } from 'vitest'

import { createMagicPatchPollingSession } from './magicPatchPollingSession'

const context = { scope: 'A/1', ready: true, online: true, visible: true }
const request: RequestStatus = {
  id: 'a'.repeat(32),
  operation_id: 'b'.repeat(32),
  state: 'waiting_conversion',
  operation_status: 'queued',
  status_version: 1
}
const success = (value: RequestPage = { requests: [request] }) => ({
  ok: true as const,
  value
})
const tick = () => vi.advanceTimersByTimeAsync(0)

function deferredPage() {
  let resolve: (page: ReturnType<typeof success>) => void = () => {}
  const promise = new Promise<ReturnType<typeof success>>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('Magic Patch polling session', () => {
  it('requires explicit readiness and scope before startup recovery', async () => {
    vi.useFakeTimers()
    const list = vi.fn(async () => success())
    const session = createMagicPatchPollingSession({ list })
    session.refreshNow()
    session.update({ ...context, ready: false })
    session.update({ ...context, scope: undefined })
    expect(list).not.toHaveBeenCalled()
    session.update(context)
    await tick()
    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0]).toHaveLength(3)
    expect(session.getState()).toMatchObject({ phase: 'idle', scope: 'A/1' })
    session.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('schedules after completion without overlap or delayed-timer catchup', async () => {
    vi.useFakeTimers()
    const page = deferredPage()
    const list = vi
      .fn()
      .mockReturnValueOnce(page.promise)
      .mockResolvedValue(success())
    const session = createMagicPatchPollingSession({ list })
    session.update(context)
    await vi.advanceTimersByTimeAsync(14000)
    expect(list).toHaveBeenCalledTimes(1)
    page.resolve(success())
    await tick()
    await vi.advanceTimersByTimeAsync(4999)
    expect(list).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(list).toHaveBeenCalledTimes(2)
    session.dispose()
  })

  it.for(['online', 'visible'] as const)(
    'pauses for %s and retains complete results while fencing late replies',
    async (key) => {
      vi.useFakeTimers()
      const late = deferredPage()
      const list = vi
        .fn()
        .mockResolvedValueOnce(success())
        .mockReturnValueOnce(late.promise)
        .mockResolvedValue(success())
      const session = createMagicPatchPollingSession({ list })
      session.update(context)
      await tick()
      session.refreshNow()
      session.update({ ...context, [key]: false })
      await tick()
      expect(list.mock.calls[1][1].aborted).toBe(true)
      expect(session.getState()).toMatchObject({
        requests: { [request.id]: request }
      })
      await vi.advanceTimersByTimeAsync(60000)
      late.resolve(success({ requests: [{ ...request, status_version: 9 }] }))
      await tick()
      expect(list).toHaveBeenCalledTimes(2)
      expect(session.getState()).toMatchObject({
        requests: { [request.id]: request }
      })
      session.update(context)
      await tick()
      expect(list).toHaveBeenCalledTimes(3)
      expect(list.mock.calls[2][0]).toBeUndefined()
      session.dispose()
    }
  )

  it('clears old scope immediately and recovers only the newest rapid scope change', async () => {
    vi.useFakeTimers()
    const late = deferredPage()
    const list = vi
      .fn()
      .mockReturnValueOnce(late.promise)
      .mockResolvedValue(success({ requests: [] }))
    const session = createMagicPatchPollingSession({ list })
    session.update(context)
    session.update({ ...context, scope: 'B/2' })
    session.update({ ...context, scope: 'C/3' })
    expect(session.getState()).toMatchObject({ scope: 'C/3', requests: {} })
    await tick()
    expect(list).toHaveBeenCalledTimes(2)
    late.resolve(success())
    await tick()
    expect(session.getState()).toMatchObject({ scope: 'C/3', requests: {} })
    session.dispose()
  })

  it('backs off repeated failures to30s and resets after a successful scan', async () => {
    vi.useFakeTimers()
    const list = vi
      .fn()
      .mockResolvedValue({ ok: false, code: 'request_failed' })
    const session = createMagicPatchPollingSession({ list })
    session.update(context)
    await tick()
    for (const delay of [5000, 10000, 20000, 30000, 30000]) {
      const before = list.mock.calls.length
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(list).toHaveBeenCalledTimes(before)
      await vi.advanceTimersByTimeAsync(1)
      expect(list).toHaveBeenCalledTimes(before + 1)
    }
    list.mockResolvedValue(success())
    await vi.advanceTimersByTimeAsync(30000)
    const completed = list.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(list).toHaveBeenCalledTimes(completed + 1)
    session.dispose()
  })

  it('resets capped backoff after success before an immediate coalesced rerun fails', async () => {
    vi.useFakeTimers()
    const list = vi
      .fn()
      .mockResolvedValue({ ok: false, code: 'request_failed' })
    const session = createMagicPatchPollingSession({ list })
    session.update(context)
    await tick()
    for (const delay of [5000, 10000, 20000]) {
      await vi.advanceTimersByTimeAsync(delay)
    }
    expect(list).toHaveBeenCalledTimes(4)
    const pendingSuccess = deferredPage()
    list.mockReturnValueOnce(pendingSuccess.promise)
    await vi.advanceTimersByTimeAsync(30000)
    expect(list).toHaveBeenCalledTimes(5)
    session.refreshNow()
    pendingSuccess.resolve(success())
    await tick()
    expect(list).toHaveBeenCalledTimes(6)
    expect(list.mock.calls[5][0]).toBeUndefined()
    expect(session.getState()).toMatchObject({
      phase: 'failed',
      requests: { [request.id]: request }
    })
    await vi.advanceTimersByTimeAsync(4999)
    expect(list).toHaveBeenCalledTimes(6)
    await vi.advanceTimersByTimeAsync(1)
    expect(list).toHaveBeenCalledTimes(7)
    session.dispose()
  })

  it('coalesces repeated explicit refreshes during a scan into one cursorless rerun', async () => {
    vi.useFakeTimers()
    const pending = deferredPage()
    const list = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(success())
    const session = createMagicPatchPollingSession({ list })
    session.update(context)
    for (let i = 0; i < 20; i++) session.refreshNow()
    expect(list).toHaveBeenCalledTimes(1)
    pending.resolve(success())
    await tick()
    expect(list).toHaveBeenCalledTimes(2)
    expect(list.mock.calls[1][0]).toBeUndefined()
    session.dispose()
  })

  it('revokes readiness immediately and refuses reopening after disposal', async () => {
    vi.useFakeTimers()
    const list = vi.fn(async () => success())
    const session = createMagicPatchPollingSession({ list })
    session.update(context)
    await tick()
    session.update({ ...context, ready: false })
    expect(session.getState()).toEqual({ phase: 'disabled' })
    await vi.advanceTimersByTimeAsync(60000)
    expect(list).toHaveBeenCalledTimes(1)
    session.dispose()
    session.update(context)
    session.refreshNow()
    expect(session.getState()).toEqual({ phase: 'disabled' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('disposes in-flight work without publishing a late completion or leaving timers', async () => {
    vi.useFakeTimers()
    const pending = deferredPage()
    const list = vi.fn(() => pending.promise)
    const session = createMagicPatchPollingSession({ list })
    session.update(context)
    session.dispose()
    await tick()
    pending.resolve(success())
    await tick()
    expect(session.getState()).toEqual({ phase: 'disabled' })
    expect(list).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
