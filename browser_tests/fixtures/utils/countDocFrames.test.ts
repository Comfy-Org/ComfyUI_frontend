import { fromPartial } from '@total-typescript/shoehorn'
import type { WebSocketRoute } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { countDocFrames } from '@e2e/fixtures/utils/countDocFrames'

describe('countDocFrames', () => {
  it('ignores unrelated and malformed socket messages', () => {
    const ws = fromPartial<WebSocketRoute>({})
    const messages = new Map([
      [
        ws,
        [
          'not-json',
          JSON.stringify({ type: 'status' }),
          JSON.stringify({ type: 'doc_subscribe', data: null }),
          JSON.stringify({
            type: 'doc_subscribe',
            data: { workflow_id: 'other-workflow' }
          }),
          JSON.stringify({
            type: 'doc_subscribe',
            data: { workflow_id: 'workflow-1' }
          })
        ]
      ]
    ])

    expect(countDocFrames(messages, ws, 'doc_subscribe', 'workflow-1')).toBe(1)
  })
})
