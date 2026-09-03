import { beforeEach, describe, expect, it } from 'vitest'
import { watch } from 'vue'

import {
  clearDevEvents,
  devEvents,
  recordDevEvent,
  stringifyDevEvents
} from './devPanelLog'
import { setCrdtDebugEnabled } from './crdtDebugGate'

describe('devPanelLog', () => {
  beforeEach(() => {
    setCrdtDebugEnabled(true)
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

  it('keeps a value referenced twice from sibling positions', () => {
    const shared = { id: 'node-7' }
    recordDevEvent('doc_update', { added: shared, removed: shared })

    const serialized = stringifyDevEvents(devEvents.value)
    expect(serialized).not.toContain('[Circular]')
    expect(serialized.match(/node-7/g)).toHaveLength(2)
  })

  it('survives a genuine cycle instead of throwing', () => {
    const cyclic: Record<string, unknown> = { kind: 'self' }
    cyclic.self = cyclic
    recordDevEvent('doc_update', cyclic)

    expect(() => stringifyDevEvents(devEvents.value)).not.toThrow()
    expect(stringifyDevEvents(devEvents.value)).toContain('[Circular]')
  })

  it('carries the scope and level a consumer filters on', () => {
    recordDevEvent('doc_update', null, { scope: 'wire', level: 'warn' })

    const [event] = devEvents.value
    expect(event.scope).toBe('wire')
    expect(event.level).toBe('warn')
  })

  it('honors explicit opt-out for direct recorders', () => {
    setCrdtDebugEnabled(false)

    recordDevEvent('doc_update', { seq: 1 })

    expect(devEvents.value).toHaveLength(0)
  })
})
