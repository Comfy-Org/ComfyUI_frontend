import { describe, expect, it } from 'vitest'

import type { ActivityPart } from './agentMessageParts'
import { foldActivity, totalDurationMs } from './agentActivityRows'

function tool(name: string, ok?: boolean, durationMs?: number): ActivityPart {
  return {
    type: 'tool',
    callId: `${name}-${durationMs}`,
    name,
    state: 'done',
    ok,
    durationMs
  }
}

describe('foldActivity', () => {
  it('folds a consecutive re-run into one counted row and sums its time', () => {
    const rows = foldActivity([
      tool('add_node', true, 1300),
      tool('add_node', true, 200)
    ])

    expect(rows).toEqual([
      {
        kind: 'tool',
        name: 'add_node',
        state: 'done',
        ok: true,
        count: 2,
        durationMs: 1500
      }
    ])
  })

  it('keeps a re-run separate once another step interrupts it', () => {
    const rows = foldActivity([
      tool('add_node', true, 100),
      tool('set_widget', true, 100),
      tool('add_node', true, 100)
    ])

    expect(rows.map((row) => row.kind === 'tool' && row.name)).toEqual([
      'add_node',
      'set_widget',
      'add_node'
    ])
  })

  it('latches a failure and an in-flight call across the fold', () => {
    const rows = foldActivity([
      tool('add_node', true, 100),
      { type: 'tool', callId: 'c2', name: 'add_node', state: 'streaming' },
      tool('add_node', false, 100)
    ])

    expect(rows[0]).toMatchObject({ count: 3, ok: false, state: 'streaming' })
  })
})

describe('totalDurationMs', () => {
  it('counts reasoning time alongside call time', () => {
    expect(
      totalDurationMs([
        { type: 'thinking', text: 'x', state: 'done', durationMs: 100 },
        tool('add_node', true, 1300)
      ])
    ).toBe(1400)
  })
})
