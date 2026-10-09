import type { RequestPage, RequestStatus } from '@comfyorg/magic-patch-types'
import { describe, expect, it, vi } from 'vitest'

import {
  createMagicPatchPoller,
  magicPatchTraversalLimits
} from './magicPatchPoller'

const request: RequestStatus = {
  id: 'a'.repeat(32),
  operation_id: 'b'.repeat(32),
  state: 'waiting_conversion',
  operation_status: 'queued',
  status_version: 1
}
const success = (value: RequestPage) => ({ ok: true as const, value })

describe('Magic Patch bounded traversal', () => {
  it('starts fresh and publishes a complete traversal, retaining terminal results', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce(
        success({ requests: [request], next_cursor: 'next' })
      )
      .mockResolvedValueOnce(
        success({
          requests: [
            {
              ...request,
              state: 'ready',
              operation_status: 'completed',
              status_version: 2
            }
          ]
        })
      )
    const poller = createMagicPatchPoller({ list })
    poller.setScope('A/1')
    await poller.refresh()
    expect(list.mock.calls[0][0]).toBeUndefined()
    expect(list.mock.calls[1][0]).toBe('next')
    expect(poller.getState()).toMatchObject({
      phase: 'idle',
      requests: { [request.id]: { state: 'ready' } }
    })
  })

  it('enforces page and conservative cumulative byte ceilings without another call', async () => {
    let page = 0
    const list = vi.fn(async (_after?: string, _signal?: AbortSignal) =>
      success({ requests: [], next_cursor: String(++page) })
    )
    const poller = createMagicPatchPoller({ list })
    poller.setScope('A/1')
    await poller.refresh()
    expect(list).toHaveBeenCalledTimes(magicPatchTraversalLimits.pages)
    expect(poller.getState()).toMatchObject({ phase: 'failed', requests: {} })
    expect(magicPatchTraversalLimits.maximumDecodedBytes).toBe(20 * 1048576)
    expect(list.mock.calls.at(-1)?.[1]?.aborted).toBe(true)
  })

  it('counts repeated entries against the traversal budget', async () => {
    let page = 0
    const list = vi.fn(async () =>
      success({
        requests: Array.from({ length: 100 }, () => request),
        next_cursor: String(++page)
      })
    )
    const poller = createMagicPatchPoller({ list })
    poller.setScope('A/1')
    await poller.refresh()
    expect(list).toHaveBeenCalledTimes(11)
    expect(poller.getState()).toMatchObject({ phase: 'failed', requests: {} })
  })

  it('preserves the last complete projection when a traversal times out, even if transport ignores abort', async () => {
    vi.useFakeTimers()
    const list = vi
      .fn()
      .mockResolvedValueOnce(success({ requests: [request] }))
      .mockImplementationOnce(() => new Promise(() => {}))
    const poller = createMagicPatchPoller({ list })
    poller.setScope('A/1')
    await poller.refresh()
    const pending = poller.refresh()
    await vi.advanceTimersByTimeAsync(magicPatchTraversalLimits.milliseconds)
    await pending
    expect(poller.getState()).toMatchObject({
      phase: 'failed',
      requests: { [request.id]: request }
    })
    expect(list.mock.calls[1][1].aborted).toBe(true)
  })

  it('aborts on a scope switch and ignores a late page from an abort-insensitive transport', async () => {
    let complete: (value: ReturnType<typeof success>) => void = () => {}
    const list = vi.fn(
      () =>
        new Promise<ReturnType<typeof success>>((resolve) => {
          complete = resolve
        })
    )
    const poller = createMagicPatchPoller({ list })
    poller.setScope('A/1')
    const pending = poller.refresh()
    poller.setScope('B/2')
    await pending
    complete(success({ requests: [request], next_cursor: 'old' }))
    await Promise.resolve()
    expect(poller.getState()).toEqual({
      phase: 'idle',
      scope: 'B/2',
      requests: {}
    })
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('restarts overlapping refreshes at the first page and fences the old traversal', async () => {
    let complete: (value: ReturnType<typeof success>) => void = () => {}
    const list = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof success>>((resolve) => {
            complete = resolve
          })
      )
      .mockResolvedValueOnce(success({ requests: [] }))
    const poller = createMagicPatchPoller({ list })
    poller.setScope('A/1')
    const older = poller.refresh()
    await poller.refresh()
    await older
    complete(success({ requests: [request] }))
    await Promise.resolve()
    expect(list.mock.calls.map((call) => call[0])).toEqual([
      undefined,
      undefined
    ])
    expect(poller.getState()).toEqual({
      phase: 'idle',
      scope: 'A/1',
      requests: {}
    })
  })

  it('does no work when disabled and stops a cursor loop before further requests', async () => {
    const list = vi.fn(async () =>
      success({ requests: [], next_cursor: 'same' })
    )
    const poller = createMagicPatchPoller({ list })
    await poller.refresh()
    expect(list).not.toHaveBeenCalled()
    poller.setScope('A/1')
    await poller.refresh()
    expect(list).toHaveBeenCalledTimes(2)
    expect(poller.getState().phase).toBe('failed')
    poller.setScope()
    expect(poller.getState()).toEqual({ phase: 'disabled' })
  })
})
