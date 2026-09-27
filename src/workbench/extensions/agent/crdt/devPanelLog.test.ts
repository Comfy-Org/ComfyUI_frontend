import { beforeEach, describe, expect, it } from 'vitest'
import { watch } from 'vue'

import {
  clearDevEvents,
  devEvents,
  recordDevEvent,
  stringifyDevEvents
} from './devPanelLog'

describe('devPanelLog', () => {
  beforeEach(() => {
    clearDevEvents()
  })

  it('records events with monotonically increasing sequence numbers', () => {
    recordDevEvent('ws_out', { frame: 'a' })
    recordDevEvent('doc_update', { seq: 1 })

    const [first, second] = devEvents.value
    expect(first.kind).toBe('ws_out')
    expect(second.kind).toBe('doc_update')
    expect(second.seq).toBeGreaterThan(first.seq)
  })

  it('caps the ring buffer, dropping the oldest entries', () => {
    for (let count = 0; count < 505; count++) {
      recordDevEvent('doc_update', { seq: count })
    }

    expect(devEvents.value).toHaveLength(500)
    expect(devEvents.value[0].detail).toEqual({ seq: 5 })
    expect(devEvents.value.at(-1)?.detail).toEqual({ seq: 504 })
  })

  it('keeps sequence numbers monotonic after eviction and clear', () => {
    for (let count = 0; count < 501; count++) {
      recordDevEvent('doc_update', { seq: count })
    }

    const firstVisibleSeq = devEvents.value[0].seq
    const lastVisibleEvent = devEvents.value.at(-1)
    expect(lastVisibleEvent).toBeDefined()
    const lastVisibleSeq = lastVisibleEvent!.seq
    expect(devEvents.value.map((event) => event.seq)).toEqual(
      Array.from({ length: 500 }, (_, index) => firstVisibleSeq + index)
    )
    expect(lastVisibleSeq).toBe(firstVisibleSeq + 499)

    clearDevEvents()
    recordDevEvent('doc_reset', null)

    expect(devEvents.value).toHaveLength(1)
    expect(devEvents.value[0].seq).toBe(lastVisibleSeq + 1)
  })

  it('notifies shallow-ref consumers after record and clear', () => {
    const snapshots: number[] = []
    const stop = watch(
      devEvents,
      (events) => {
        snapshots.push(events.length)
      },
      { flush: 'sync' }
    )

    try {
      recordDevEvent('ws_out', { frame: 'a' })
      expect(devEvents.value.map((event) => event.kind)).toEqual(['ws_out'])
      clearDevEvents()

      expect(devEvents.value).toEqual([])
      expect(snapshots).toEqual([1, 0])
    } finally {
      stop()
    }
  })

  it('stringifies binary payloads defensively', () => {
    recordDevEvent('doc_update', {
      buffer: new ArrayBuffer(4),
      clamped: new Uint8ClampedArray([1, 2, 3]),
      view: new DataView(new ArrayBuffer(2))
    })

    const serialized = stringifyDevEvents(devEvents.value)
    const parsed = JSON.parse(serialized) as Array<{
      detail: { buffer: string; clamped: string; view: string }
    }>
    expect(parsed[0].detail).toEqual({
      buffer: 'ArrayBuffer(4)',
      clamped: 'Uint8ClampedArray(3)',
      view: 'DataView(2)'
    })
  })
})
