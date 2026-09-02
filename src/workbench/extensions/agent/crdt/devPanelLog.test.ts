import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearDevEvents,
  devEvents,
  recordDevEvent,
  stringifyDevEvents
} from './devPanelLog'

describe('devPanelLog redaction', () => {
  beforeEach(() => clearDevEvents())

  it('removes sensitive fields before storing an event', () => {
    recordDevEvent('ws_out', {
      delivered: true,
      authorization: 'Bearer secret-auth',
      frame: {
        type: 'doc_ops',
        seq: 17,
        access_token: 'secret-token',
        ops: [
          {
            op: 'set_widget',
            op_id: 'op-123',
            node_id: 42,
            name: 'seed',
            value: 'secret-op-value',
            outcome: 'applied'
          },
          {
            op: 'add_node',
            op_id: 'op-456',
            node: {
              id: 43,
              widgets_values: ['secret-widget', 12],
              widgets_values_named: {
                prompt: 'secret-named-widget',
                steps: 20
              }
            }
          }
        ]
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
          seq: 17,
          access_token: '[REDACTED]',
          ops: [
            {
              op: 'set_widget',
              op_id: 'op-123',
              node_id: 42,
              name: 'seed',
              value: '[REDACTED]',
              outcome: 'applied'
            },
            {
              op: 'add_node',
              op_id: 'op-456',
              node: {
                id: 43,
                widgets_values: ['[REDACTED]', '[REDACTED]'],
                widgets_values_named: {
                  prompt: '[REDACTED]',
                  steps: '[REDACTED]'
                }
              }
            }
          ]
        },
        binary: new Uint8Array([1, 2, 3])
      }
    })
    expect(JSON.stringify(devEvents.value)).not.toMatch(
      /secret-(auth|token|op-value|widget|named-widget)/
    )
  })

  it('keeps structural metadata and binary lengths in serialized events', () => {
    recordDevEvent('doc_ops_result', {
      seq: 9,
      op_id: 'op-789',
      outcome: 'rejected',
      password: 'secret-password',
      message_text: 'secret-message',
      update: new Uint8Array(8)
    })

    const serialized = stringifyDevEvents(devEvents.value)

    expect(serialized).toContain('op-789')
    expect(serialized).toContain('rejected')
    expect(serialized).toContain('Uint8Array(8)')
    expect(serialized).toContain('[REDACTED]')
    expect(serialized).not.toContain('secret-password')
    expect(serialized).not.toContain('secret-message')
  })
})
