import { beforeEach, describe, expect, it } from 'vitest'

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
  })

  it('stringifies binary payloads defensively', () => {
    recordDevEvent('doc_update', { update: new Uint8Array(16) })

    const serialized = stringifyDevEvents(devEvents.value)
    expect(serialized).toContain('"Uint8Array(16)"')
  })
})
