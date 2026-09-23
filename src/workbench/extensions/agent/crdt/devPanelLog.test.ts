import { beforeEach, describe, expect, it, vi } from 'vitest'
import { watch } from 'vue'

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock(import('@/platform/telemetry/reportError'), () => ({ reportError }))

import { setCrdtDebugEnabled } from './crdtDebugGate'
import {
  clearDevEvents,
  devEvents,
  recordDevEvent,
  stringifyDevEvents
} from './devPanelLog'

describe('devPanelLog', () => {
  beforeEach(() => {
    setCrdtDebugEnabled(true)
    clearDevEvents()
    reportError.mockClear()
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
      widgetsValues: ['secret-widget'],
      Value: 'secret-value',
      token_count: 3,
      context: 'kept-context',
      prompt_id: 'kept-prompt-id',
      class_type: 'kept-class'
    })

    expect(devEvents.value[0]?.detail).toEqual({
      accessToken: '[REDACTED]',
      'x-api-key': '[REDACTED]',
      widgetsValues: '[REDACTED]',
      Value: '[REDACTED]',
      token_count: 3,
      context: 'kept-context',
      prompt_id: 'kept-prompt-id',
      class_type: 'kept-class'
    })
  })

  it('keeps the structural diagnosis on failed frames', () => {
    recordDevEvent('doc_ops_result', {
      workflowId: 'wf-1',
      ok: false,
      applied: [],
      skipped: ['op-1'],
      code: 'op_failed',
      message: 'unknown node 7',
      failed: { op_id: 'op-1', code: 'unknown_node', message: 'unknown node 7' }
    })

    expect(devEvents.value[0]?.detail).toEqual({
      workflowId: 'wf-1',
      ok: false,
      applied: [],
      skipped: ['op-1'],
      code: 'op_failed',
      message: 'String(14)',
      failed: { op_id: 'op-1', code: 'unknown_node', message: 'String(14)' }
    })
  })

  it('redacts credentials carried by strings under unrecognized keys', () => {
    recordDevEvent('doc_ops_result', {
      workflowId: 'wf-1',
      ok: false,
      code: 'upload_failed',
      message:
        'PUT https://svc:hunter2@assets.example.com/a.png?X-Amz-Signature=abcdef0123456789&access_token=abcdef0123456789 failed',
      url: 'https://svc:hunter2@assets.example.com/a.png?X-Amz-Signature=abcdef0123456789',
      description: 'retry with Bearer sk-live-0123456789abcdef',
      failed: { op_id: 'op-1', code: 'unknown_node' }
    })

    const copied = stringifyDevEvents(devEvents.value)
    expect(copied).not.toContain('hunter2')
    expect(copied).not.toContain('X-Amz-Signature')
    expect(copied).not.toContain('access_token')
    expect(copied).not.toContain('sk-live-0123456789abcdef')
    expect(devEvents.value[0]?.detail).toEqual({
      workflowId: 'wf-1',
      ok: false,
      code: 'upload_failed',
      message: 'String(118)',
      url: 'String(77)',
      description: 'String(42)',
      failed: { op_id: 'op-1', code: 'unknown_node' }
    })
  })

  it('sanitizes a credential that reaches a structural key', () => {
    recordDevEvent('doc_subscribed', {
      workflowId: 'wf-1',
      target: 'sk-live-0123456789abcdef'
    })

    expect(devEvents.value[0]?.detail).toEqual({
      workflowId: 'wf-1',
      target: '[REDACTED]'
    })
  })

  it('summarizes free-form producer prose instead of retaining it', () => {
    recordDevEvent('doc_ops_result', {
      workflowId: 'wf-1',
      ok: false,
      code: 'op_failed',
      description: 'customer requested analysis of a private medical scan',
      message: 'unknown node 7',
      failed: { op_id: 'op-1', code: 'unknown_node' }
    })

    const copied = stringifyDevEvents(devEvents.value)
    expect(copied).not.toContain('private medical scan')
    expect(devEvents.value[0]?.detail).toEqual({
      workflowId: 'wf-1',
      ok: false,
      code: 'op_failed',
      description: 'String(53)',
      message: 'String(14)',
      failed: { op_id: 'op-1', code: 'unknown_node' }
    })
  })

  it('summarizes an unlisted credential format under an unlisted key', () => {
    recordDevEvent('doc_subscribed', {
      workflowId: 'wf-1',
      note: 'authenticate with corp-cred-9d41f0b27ac3e5'
    })

    expect(stringifyDevEvents(devEvents.value)).not.toContain(
      'corp-cred-9d41f0b27ac3e5'
    )
  })

  it('preserves bounded descriptions of non-plain objects', () => {
    recordDevEvent('doc_update', {
      error: new TypeError('invalid update'),
      map: new Map([['token', 'secret']]),
      set: new Set(['secret']),
      date: new Date('2026-09-04T06:00:00.000Z')
    })

    expect(devEvents.value[0]?.detail).toEqual({
      error: { name: 'TypeError', message: 'String(14)' },
      map: 'Map(1)',
      set: 'Set(1)',
      date: '2026-09-04T06:00:00.000Z'
    })
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

  it('redacts and reports details that cannot be inspected safely', () => {
    const detail = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('secret payload')
        }
      }
    )

    expect(() => recordDevEvent('doc_update', detail)).not.toThrow()
    expect(devEvents.value[0]?.detail).toBe('[REDACTED]')
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to sanitize CRDT dev event detail'
      }),
      { errorType: 'crdt_dev_event_sanitization_failed' }
    )
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
