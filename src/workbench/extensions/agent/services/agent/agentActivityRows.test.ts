import { describe, expect, it } from 'vitest'

import type { ToolPart } from './agentMessageParts'
import { foldActivity } from './agentActivityRows'

function tool(name: string, ok?: boolean, durationMs?: number): ToolPart {
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
  it('folds a consecutive re-run into one counted row', () => {
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
        count: 2
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

  it('keeps different loaded skills as distinct steps', () => {
    const rows = foldActivity([
      { ...tool('load_skill'), skill: 'building' },
      { ...tool('load_skill'), skill: 'comfy-director' }
    ])

    expect(rows).toEqual([
      expect.objectContaining({ skill: 'building', count: 1 }),
      expect.objectContaining({ skill: 'comfy-director', count: 1 })
    ])
  })

  it('ignores skill metadata for tools that do not display it', () => {
    const rows = foldActivity([
      { ...tool('search_nodes'), skill: 'building' },
      { ...tool('search_nodes'), skill: 'comfy-director' }
    ])

    expect(rows).toEqual([
      expect.objectContaining({ name: 'search_nodes', count: 2 })
    ])
  })

  it('uses the latest settled outcome and retains the in-flight state', () => {
    const rows = foldActivity([
      tool('add_node', true, 100),
      { type: 'tool', callId: 'c2', name: 'add_node', state: 'streaming' },
      tool('add_node', false, 101)
    ])

    expect(rows[0]).toMatchObject({ count: 3, ok: false, state: 'streaming' })
  })

  it('retains the settled outcome when the latest retry is still streaming', () => {
    const rows = foldActivity([
      tool('add_node', true, 100),
      tool('add_node', false, 101),
      { type: 'tool', callId: 'c2', name: 'add_node', state: 'streaming' }
    ])

    expect(rows[0]).toMatchObject({ count: 3, ok: false, state: 'streaming' })
  })

  it('shows a successful retry as successful', () => {
    const rows = foldActivity([
      { ...tool('load_skill', false), skill: 'comfy-director' },
      { ...tool('load_skill', true), skill: 'comfy-director' }
    ])

    expect(rows[0]).toMatchObject({ count: 2, ok: true })
  })
})
