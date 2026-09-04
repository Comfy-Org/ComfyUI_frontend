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

  it('removes sensitive fields before storing an event', () => {
    recordDevEvent('ws_out', {
      delivered: true,
      authorization: 'Bearer secret-auth',
      frame: {
        type: 'doc_ops',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          tab: 'tab-1',
          access_token: 'secret-token',
          ops: [
            {
              op: 'set_widget',
              op_id: 'op-123',
              node_id: 42,
              name: 'seed',
              value: 'secret-op-value',
              old: 'secret-old-value',
              outcome: 'applied'
            },
            {
              op: 'add_node',
              op_id: 'op-456',
              class_type: 'CLIPTextEncode',
              node: { id: 43, widgets_values: ['secret-widget', 12] }
            }
          ]
        }
      },
      binary: new Uint8Array([1, 2, 3])
    })

    expect(devEvents.value[0]).toMatchObject({
      kind: 'ws_out',
      detail: {
        delivered: true,
        authorization: '[REDACTED]',
        frame: {
          type: 'doc_ops',
          data: {
            v: 1,
            workflow_id: 'wf-1',
            tab: 'tab-1',
            access_token: '[REDACTED]',
            ops: [
              {
                op: 'set_widget',
                op_id: 'op-123',
                node_id: 42,
                name: 'seed',
                value: '[REDACTED]',
                old: '[REDACTED]',
                outcome: 'applied'
              },
              {
                op: 'add_node',
                op_id: 'op-456',
                class_type: 'CLIPTextEncode',
                node: '[REDACTED]'
              }
            ]
          }
        },
        binary: 'Uint8Array(3)'
      }
    })
    expect(JSON.stringify(devEvents.value)).not.toMatch(
      /secret-(auth|token|op-value|old-value|widget)/
    )
  })

  it('redacts common key formats without hiding structural metadata', () => {
    recordDevEvent('doc_subscribed', {
      accessToken: 'secret-camel',
      'x-api-key': 'secret-header',
      token_count: 3,
      context: 'kept-context',
      prompt_id: 'kept-prompt-id',
      class_type: 'kept-class'
    })

    expect(devEvents.value[0]?.detail).toEqual({
      accessToken: '[REDACTED]',
      'x-api-key': '[REDACTED]',
      token_count: 3,
      context: 'kept-context',
      prompt_id: 'kept-prompt-id',
      class_type: 'kept-class'
    })
  })

  it('keeps server error messages on failed frames', () => {
    const detail = {
      workflowId: 'wf-1',
      ok: false,
      applied: [],
      skipped: ['op-1'],
      code: 'op_failed',
      message: 'unknown node 7',
      failed: { op_id: 'op-1', code: 'unknown_node', message: 'unknown node 7' }
    }
    recordDevEvent('doc_ops_result', detail)

    expect(devEvents.value[0]?.detail).toEqual(detail)
  })

  it('collapses values nested beyond the depth cap', () => {
    let detail: Record<string, unknown> = { leaf: 'kept-leaf' }
    for (let i = 0; i < 14; i++) detail = { child: detail }
    recordDevEvent('doc_update', detail)

    const serialized = stringifyDevEvents(devEvents.value)
    expect(serialized).toContain('[REDACTED]')
    expect(serialized).not.toContain('kept-leaf')
    expect(serialized.match(/"child":/g)).toHaveLength(13)
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

  it('does not retain events while the debug instrument is disabled', () => {
    setCrdtDebugEnabled(false)

    recordDevEvent('doc_update', { seq: 1 })

    expect(devEvents.value).toHaveLength(0)
  })
})
