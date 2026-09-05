import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

import type {
  AssembleInput,
  NormalizedRows,
  RawCapture,
  RecordedFrame,
  RecordedTurn,
  SeedFixture
} from './agentConversationAssemble'
import { assembleConversation, zRowsDump } from './agentConversationAssemble'
import { OP_ENVELOPE_KEYS } from '../browser_tests/fixtures/data/agent/agentConversation'

const THREAD = 'thread-1'
const MESSAGE = 'message-1'
const SEED_MESSAGE = 'seed-message-1'
const WORKFLOW = '6f1c2c1e-3b1c-4c88-9d9c-0d6e9b8e1a01'

const turnFrame = (
  type: string,
  data: Record<string, unknown>,
  at_ms: number
): RecordedFrame => ({
  type,
  data: { thread_id: THREAD, message_id: MESSAGE, ...data },
  at_ms
})

const frames = (): RecordedFrame[] => [
  turnFrame('agent_thinking', { delta: 'switching' }, 1_700_000_000_000),
  turnFrame(
    'agent_active_tab',
    { workflow_id: WORKFLOW, name: 'Text to image' },
    1_700_000_000_100
  ),
  turnFrame(
    'agent_tool_call',
    { tool_call_id: 'tool-1', tool_name: 'apply_ops', status: 'success' },
    1_700_000_000_200
  ),
  turnFrame('agent_message_done', {}, 1_700_000_000_300)
]

type ConversationTurn = ReturnType<
  typeof assembleConversation
>['conversation']['turns'][number]

const turnEvents = (turn: ConversationTurn): RecordedFrame[] =>
  turn.response.flatMap((entry) =>
    entry.kind === 'event' ? [entry.event] : []
  )

const turnEventTypes = (turn: ConversationTurn): string[] =>
  turnEvents(turn).map((event) => event.type)

const seed = (): SeedFixture => ({
  workflow: {
    id: WORKFLOW,
    name: 'Text to image',
    catalog: { types: { KSampler: { widget_order: ['steps'] } } },
    seed: {
      nodes: [
        { id: 3, type: 'CheckpointLoaderSimple' },
        { id: 4, type: 'KSampler' }
      ],
      links: []
    }
  }
})

const addNodeOp = {
  op: 'add_node',
  op_id: 'op-1',
  node_id: 10,
  class_type: 'KSampler'
}
// The same op as a recording carries it: the export drops the wire envelope.
const { op_id: _addNodeOpId, ...addNodeOpSemantic } = addNodeOp

const parent = (
  overrides: Partial<RowsInput['parents'][number]> = {}
): RowsInput['parents'][number] => ({
  id: 'parent-1',
  tool_call_id: 'tool-1',
  tool_name: 'apply_ops',
  status: 'ok',
  workflow_id: WORKFLOW,
  result: { ok: true, data: { ops: [addNodeOp] } },
  children: [{ op_id: 'op-1', status: 'ok' }],
  ...overrides
})

const raw = (overrides: Partial<RawCapture> = {}): RawCapture => ({
  case_id: 'agent-rec-example',
  attempt: 'a1',
  base: 'http://127.0.0.1:8086',
  frame_source: 'redis SUBSCRIBE channel:ws:<workspace>:u:<user>',
  channel: 'channel:ws:w-secret:u:u-secret',
  seed_sha256: 'a'.repeat(64),
  seed_name: 'Text to image',
  seed_node_ids: [3, 4],
  saw_stream: true,
  stream_closed: false,
  seed_turn: {
    status: 202,
    body: { thread_id: 'seed-thread', message_id: SEED_MESSAGE }
  },
  seed_workflow_id: WORKFLOW,
  turns: [
    {
      prompt: "Switch to the tab 'Text to image', then add a sampler.",
      accepted: {
        status: 202,
        body: {
          thread_id: THREAD,
          message_id: MESSAGE,
          workflow_id: 'blank-wf'
        }
      },
      saw_done: true
    }
  ],
  timed_out: false,
  frames: frames(),
  error: null,
  ...overrides
})

type RowsInput = z.input<typeof zRowsDump>

const rows = (overrides: Partial<RowsInput> = {}): NormalizedRows => {
  const { parents, draft } = zRowsDump.parse({
    source: 'postgres',
    parents: [parent()],
    draft: { nodes: [{ id: 3 }, { id: 4 }, { id: 10 }], links: [] },
    ...overrides
  })
  return {
    parents,
    draft,
    retrieval: { kind: 'postgres-json' },
    path: '/tmp/agent-rec-example.a1.rows.json',
    sha256: 'b'.repeat(64)
  }
}

const input = (
  overrides: Partial<Omit<AssembleInput, 'rows'>> & {
    rows?: NormalizedRows | NormalizedRows[]
  } = {}
): AssembleInput => {
  const { rows: given, ...rest } = overrides
  return {
    raw: raw(),
    seed: { json: seed(), path: 'seed.json', sha256: 'a'.repeat(64) },
    provenance: {
      cloudSha: '9dc1da7',
      model: 'claude-opus-5',
      exportedAt: '2026-09-03T01:00:00.000Z'
    },
    rawSha256: 'c'.repeat(64),
    rawPath: '/tmp/agent-rec-example.a1.raw.json',
    ...rest,
    rows: given === undefined ? [rows()] : [given].flat()
  }
}

describe('assembleConversation', () => {
  const cancelledTurn = (
    cancel_ack: RawCapture['turns'][number]['cancel_ack'],
    cancel_sent_at_ms = Number.MAX_SAFE_INTEGER
  ) =>
    raw({
      turns: [{ ...raw().turns[0], cancel_sent_at_ms, cancel_ack }]
    })

  it('refuses a cancelled turn whose cancel the backend rejected', () => {
    expect(() =>
      assembleConversation(
        input({ raw: cancelledTurn({ status: 500, body: null }) })
      )
    ).toThrow('cancel was not accepted')
    expect(() =>
      assembleConversation(input({ raw: cancelledTurn(null) }))
    ).toThrow('cancel was not accepted')
  })

  it('records the cancel marker only for an accepted cancel', () => {
    const { conversation } = assembleConversation(
      input({ raw: cancelledTurn({ status: 202, body: {} }) })
    )
    expect(conversation.turns[0].cancel_after).toBe(
      conversation.turns[0].response.length - 1
    )
  })

  it('emits the turn response at its offsets with the applied ops inline', () => {
    const { conversation, receipt } = assembleConversation(input())

    expect(conversation.workflow.id).toBe(WORKFLOW)
    expect(conversation.schema_version).toBe('agent-conversation.v2')
    expect(conversation.source).toMatchObject({
      response_side: 'recorded',
      capture: { backend: 'Comfy-Org/cloud', thread_id: THREAD }
    })
    expect(conversation.turns).toHaveLength(1)
    expect(conversation.turns[0].message_id).toBe(MESSAGE)
    expect(
      conversation.turns[0].response.map((entry) =>
        entry.kind === 'event' ? entry.event.type : entry.kind
      )
    ).toEqual([
      'agent_thinking',
      'agent_active_tab',
      'graph_ops',
      'agent_tool_call',
      'agent_message_done'
    ])
    expect(conversation.turns[0].response.map((entry) => entry.at_ms)).toEqual([
      0, 100, 200, 200, 300
    ])
    expect(
      conversation.turns[0].response.find((entry) => entry.kind === 'graph_ops')
    ).toMatchObject({ ops: [addNodeOpSemantic] })
    expect(receipt).toMatchObject({
      added_nodes: 1,
      deleted_nodes: 0,
      unexplained_draft_nodes: 0
    })
    expect(receipt.turns).toEqual([
      {
        message_id: MESSAGE,
        frames_kept: 4,
        parents: 1,
        mutating_parents: 1,
        child_statuses: { ok: 1 },
        rows: '/tmp/agent-rec-example.a1.rows.json',
        rows_sha256: 'b'.repeat(64)
      }
    ])
  })

  it('strips the routing ids the replay does not carry', () => {
    const { conversation } = assembleConversation(input())
    const [entry] = conversation.turns[0].response

    expect(entry.kind).toBe('event')
    if (entry.kind !== 'event') return
    expect(entry.event.data).not.toHaveProperty('thread_id')
    expect(entry.event.data).not.toHaveProperty('message_id')
  })

  it('strips the wire envelope from the exported ops', () => {
    const { conversation } = assembleConversation(input())
    const entry = conversation.turns[0].response.find(
      (item) => item.kind === 'graph_ops'
    )

    expect(entry?.kind).toBe('graph_ops')
    if (entry?.kind !== 'graph_ops') return
    expect(entry.ops).not.toHaveLength(0)
    for (const op of entry.ops)
      for (const key of OP_ENVELOPE_KEYS) expect(op).not.toHaveProperty(key)
  })

  it('accepts a node the ops delete and then add back', () => {
    const { receipt } = assembleConversation(
      input({
        rows: rows({
          parents: [
            parent({
              result: {
                ok: true,
                data: {
                  ops: [
                    { op: 'delete_node', op_id: 'op-1', node_id: 4 },
                    {
                      op: 'add_node',
                      op_id: 'op-2',
                      node_id: 4,
                      class_type: 'KSampler'
                    }
                  ]
                }
              },
              children: [
                { op_id: 'op-1', status: 'ok' },
                { op_id: 'op-2', status: 'ok' }
              ]
            })
          ],
          draft: { nodes: [{ id: 3 }, { id: 4 }], links: [] }
        })
      })
    )

    expect(receipt).toMatchObject({
      added_nodes: 0,
      deleted_nodes: 0,
      unexplained_draft_nodes: 0
    })
  })

  it('refuses a tool call whose terminal frame arrived twice', () => {
    const doubled = frames()
    doubled.splice(
      3,
      0,
      turnFrame(
        'agent_tool_call',
        { tool_call_id: 'tool-1', tool_name: 'apply_ops', status: 'success' },
        1_700_000_000_250
      )
    )

    expect(() =>
      assembleConversation(input({ raw: raw({ frames: doubled }) }))
    ).toThrow('more than one terminal frame')
  })

  it('refuses audit rows that repeat one tool call', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({ parents: [parent(), parent({ id: 'parent-2' })] })
        })
      )
    ).toThrow('repeat tool calls')
  })

  it('refuses a tool-call frame carrying an unknown status', () => {
    expect(() =>
      assembleConversation(
        input({
          raw: raw({
            frames: [
              ...frames().slice(0, 2),
              turnFrame(
                'agent_tool_call',
                { tool_call_id: 'tool-1', status: 'queued' },
                1_700_000_000_200
              ),
              frames()[3]
            ]
          })
        })
      )
    ).toThrow(/only running, success or error are known/)
  })

  it('leaves the offset out when the frames carry no receipt time', () => {
    const { conversation } = assembleConversation(
      input({
        raw: raw({ frames: frames().map(({ type, data }) => ({ type, data })) })
      })
    )

    for (const entry of conversation.turns[0].response)
      expect(entry.at_ms).toBeUndefined()
  })

  it('records the note without the concrete redis channel', () => {
    const { conversation, receipt } = assembleConversation(input())

    expect(conversation.source.note).toContain(
      'channel:ws:<workspace>:u:<user>'
    )
    expect(conversation.source.note).not.toContain('w-secret')
    expect(receipt.channel).toContain('w-secret')
  })

  it('accepts a delete_node whose node id is zero', () => {
    const { receipt } = assembleConversation(
      input({
        seed: {
          json: {
            workflow: {
              ...seed().workflow,
              seed: { nodes: [{ id: 0, type: 'KSampler' }], links: [] }
            }
          },
          path: 'seed.json',
          sha256: 'a'.repeat(64)
        },
        raw: raw({ seed_node_ids: [0] }),
        rows: rows({
          parents: [
            parent({
              result: {
                ok: true,
                data: {
                  ops: [{ op: 'delete_node', op_id: 'op-1', node_id: 0 }]
                }
              }
            })
          ],
          draft: { nodes: [], links: [] }
        })
      })
    )

    expect(receipt.deleted_nodes).toBe(1)
  })

  it('accepts a batch the document rejected as zero applied ops', () => {
    const { receipt } = assembleConversation(
      input({
        rows: rows({
          parents: [
            parent({
              status: 'error',
              children: [{ op_id: 'op-1', status: 'error' }]
            })
          ],
          draft: { nodes: [{ id: 3 }, { id: 4 }], links: [] }
        })
      })
    )

    expect(receipt.turns[0].mutating_parents).toBe(0)
    expect(receipt.turns[0].child_statuses).toEqual({ error: 1 })
  })

  it('accepts a read tool that echoes ops without writing child rows', () => {
    const { conversation, receipt } = assembleConversation(
      input({
        rows: rows({
          parents: [
            parent({
              tool_name: 'plan_path',
              children: [],
              result: { ok: true, data: { ops: [addNodeOp] } }
            })
          ],
          draft: { nodes: [{ id: 3 }, { id: 4 }], links: [] }
        })
      })
    )

    expect(
      conversation.turns[0].response.some((entry) => entry.kind === 'graph_ops')
    ).toBe(false)
    expect(receipt.turns[0].mutating_parents).toBe(0)
  })

  it('drops the ambient heartbeat and a non-replay turn frame into buckets', () => {
    const { receipt } = assembleConversation(
      input({
        raw: raw({
          frames: [
            {
              type: 'draft_version',
              data: { workflow_id: WORKFLOW, version: 3 }
            },
            turnFrame('draft_patch', { seq: 1 }, 1_700_000_000_050),
            {
              type: 'agent_message_delta',
              data: {
                thread_id: 'seed-thread',
                message_id: SEED_MESSAGE,
                delta: 'ack'
              }
            },
            ...frames()
          ]
        })
      })
    )

    expect(receipt.frames_dropped).toEqual({
      'type:draft_version': 1,
      'type:draft_patch': 1,
      seed_turn: 1
    })
    expect(receipt.turns[0].frames_kept).toBe(4)
  })

  it('refuses an applied add_node whose class is outside the seed catalog', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({
                result: {
                  ok: true,
                  data: {
                    ops: [{ ...addNodeOp, class_type: 'LatentUpscaleBy' }]
                  }
                }
              })
            ]
          })
        })
      )
    ).toThrow('are not in the seed catalog')
  })

  it('refuses an applied parent row that names another workflow', () => {
    expect(() =>
      assembleConversation(
        input({ rows: rows({ parents: [parent({ workflow_id: null })] }) })
      )
    ).toThrow('not the seeded workflow')
  })

  it('refuses an unparseable socket payload', () => {
    expect(() =>
      assembleConversation(
        input({
          raw: raw({
            frames: [
              { type: '__raw__', data: { payload: 'not json' } },
              ...frames()
            ]
          })
        })
      )
    ).toThrow('unparseable socket payload')
  })

  it('refuses rows whose tool calls disagree with the recorded frames', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent(),
              parent({
                id: 'parent-2',
                tool_call_id: 'tool-2',
                children: [],
                result: { ok: true }
              })
            ]
          })
        })
      )
    ).toThrow('disagree; the rows are not this turn')
  })

  it('refuses an applied op that its parent result never echoed', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({ children: [{ op_id: 'op-missing', status: 'ok' }] })
            ]
          })
        })
      )
    ).toThrow('are not echoed in its result')
  })

  it('refuses applied ops whose parent recorded no result at all', () => {
    expect(() =>
      assembleConversation(
        input({ rows: rows({ parents: [parent({ result: null })] }) })
      )
    ).toThrow('has applied ops but a NULL result')
  })

  it('refuses an echoed op kind outside the frozen op set', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({
                result: {
                  ok: true,
                  data: {
                    ops: [addNodeOp, { op: 'reset_doc', op_id: 'op-2' }]
                  }
                }
              })
            ]
          })
        })
      )
    ).toThrow('outside the frozen op set')
  })

  it('refuses a non-object echoed op entry', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({
                result: { ok: true, data: { ops: [addNodeOp, 'bogus'] } }
              })
            ]
          })
        })
      )
    ).toThrow('non-object op entry')
  })

  it('refuses an applied delete_node without a node id', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({
                result: {
                  ok: true,
                  data: { ops: [{ op: 'delete_node', op_id: 'op-1' }] }
                }
              })
            ]
          })
        })
      )
    ).toThrow('applied delete_node without node_id')
  })

  it('refuses an attempt label that would collide across attempts', () => {
    expect(() =>
      assembleConversation(input({ raw: raw({ attempt: '' }) }))
    ).toThrow('is not [A-Za-z0-9_-]+')
  })

  it('refuses a seed the driver did not use', () => {
    expect(() =>
      assembleConversation(input({ raw: raw({ seed_node_ids: [3, 4, 99] }) }))
    ).toThrow('but the seed fixture given here has')
  })

  it('refuses a turn with no active tab frame', () => {
    expect(() =>
      assembleConversation(
        input({
          raw: raw({
            frames: frames().filter(
              (frame) => frame.type !== 'agent_active_tab'
            )
          })
        })
      )
    ).toThrow('no agent_active_tab frame in this turn')
  })

  it('refuses a turn whose last frame is not the done frame', () => {
    expect(() =>
      assembleConversation(
        input({ raw: raw({ frames: frames().slice(0, -1) }) })
      )
    ).toThrow('not agent_message_done')
  })

  it('refuses an agent frame type the replay cannot validate', () => {
    expect(() =>
      assembleConversation(
        input({
          raw: raw({
            frames: [
              turnFrame('agent_not_a_frame', {}, 1_700_000_000_050),
              ...frames()
            ]
          })
        })
      )
    ).toThrow('outside the replay union')
  })

  it('refuses a draft that lost a seed node nothing deleted', () => {
    expect(() =>
      assembleConversation(
        input({ rows: rows({ draft: { nodes: [{ id: 3 }], links: [] } }) })
      )
    ).toThrow('lacks node ids')
  })

  it('refuses a draft that still holds a deleted node', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({
                result: {
                  ok: true,
                  data: {
                    ops: [{ op: 'delete_node', op_id: 'op-1', node_id: 3 }]
                  }
                }
              })
            ]
          })
        })
      )
    ).toThrow('still holds node ids')
  })

  it('refuses a turn the backend never accepted', () => {
    expect(() =>
      assembleConversation(
        input({
          raw: raw({
            turns: [
              { ...raw().turns[0], accepted: { status: 500, body: null } }
            ]
          })
        })
      )
    ).toThrow('turn 1 not accepted')
  })

  it('refuses a recording whose frame stream never opened', () => {
    expect(() =>
      assembleConversation(input({ raw: raw({ saw_stream: false }) }))
    ).toThrow('frame stream never opened')
  })

  it('refuses a recording with no terminal done frame observed', () => {
    expect(() =>
      assembleConversation(
        input({ raw: raw({ turns: [{ ...raw().turns[0], saw_done: false }] }) })
      )
    ).toThrow('never arrived')
  })

  it('refuses a seeded workflow the active tab never named', () => {
    expect(() =>
      assembleConversation(
        input({
          raw: raw({ seed_workflow_id: '11111111-2222-4333-8444-555555555555' })
        })
      )
    ).toThrow('is not the seeded workflow')
  })

  it('leaves cancel_after out of a turn that ran to completion', () => {
    const { conversation } = assembleConversation(input())
    expect(conversation.turns[0].cancel_after).toBeUndefined()
  })

  it('maps a mid-stream cancel to the response entry after the inserted ops', () => {
    const { conversation } = assembleConversation(
      input({
        raw: cancelledTurn({ status: 202, body: {} }, 1_700_000_000_200)
      })
    )
    expect(
      conversation.turns[0].response.map((entry) =>
        entry.kind === 'event' ? entry.event.type : entry.kind
      )
    ).toEqual([
      'agent_thinking',
      'agent_active_tab',
      'graph_ops',
      'agent_tool_call',
      'agent_message_done'
    ])
    expect(conversation.turns[0].cancel_after).toBe(3)
  })

  it('emits only the durably applied ops when the result echoes more', () => {
    const rejected = {
      op: 'add_node',
      op_id: 'op-2',
      node_id: 11,
      class_type: 'KSampler'
    }
    const { conversation, receipt } = assembleConversation(
      input({
        rows: rows({
          parents: [
            parent({
              result: { ok: true, data: { ops: [addNodeOp, rejected] } },
              children: [{ op_id: 'op-1', status: 'ok' }]
            })
          ]
        })
      })
    )
    expect(
      conversation.turns[0].response.find((entry) => entry.kind === 'graph_ops')
    ).toEqual({ kind: 'graph_ops', ops: [addNodeOpSemantic], at_ms: 200 })
    expect(receipt).toMatchObject({ added_nodes: 1, deleted_nodes: 0 })
  })

  it('counts a frame from another turn instead of keeping or refusing it', () => {
    const foreign: RecordedFrame = {
      type: 'agent_thinking',
      data: { thread_id: 'other-thread', message_id: 'other-message' },
      at_ms: 1_700_000_000_050
    }
    const { conversation, receipt } = assembleConversation(
      input({ raw: raw({ frames: [...frames(), foreign] }) })
    )
    expect(turnEventTypes(conversation.turns[0])).toEqual([
      'agent_thinking',
      'agent_active_tab',
      'agent_tool_call',
      'agent_message_done'
    ])
    expect(receipt.frames_dropped).toEqual({ foreign: 1 })
  })

  it('refuses a mutating call whose only frame is still running', () => {
    const running = frames().map((frame) =>
      frame.type === 'agent_tool_call'
        ? { ...frame, data: { ...frame.data, status: 'running' } }
        : frame
    )
    expect(() =>
      assembleConversation(input({ raw: raw({ frames: running }) }))
    ).toThrow('disagree; the rows are not this turn')
  })
})

const MESSAGE_2 = 'message-2'

const connectOp = { op: 'connect', op_id: 'op-2', from: 10, to: 3 }

const secondTurnFrames = (): RecordedFrame[] => [
  {
    type: 'agent_thinking',
    data: { thread_id: THREAD, message_id: MESSAGE_2, delta: 'wiring' },
    at_ms: 1_700_000_001_000
  },
  {
    type: 'agent_tool_call',
    data: {
      thread_id: THREAD,
      message_id: MESSAGE_2,
      tool_call_id: 'tool-2',
      tool_name: 'connect',
      status: 'success'
    },
    at_ms: 1_700_000_001_100
  },
  {
    type: 'agent_message_done',
    data: { thread_id: THREAD, message_id: MESSAGE_2 },
    at_ms: 1_700_000_001_200
  }
]

const secondTurn = (overrides: Partial<RecordedTurn> = {}): RecordedTurn => ({
  prompt: 'Now connect it to the sampler.',
  accepted: {
    status: 202,
    body: { thread_id: THREAD, message_id: MESSAGE_2 }
  },
  saw_done: true,
  ...overrides
})

const secondRows = (): NormalizedRows =>
  rows({
    parents: [
      parent({
        id: 'parent-2',
        tool_call_id: 'tool-2',
        tool_name: 'connect',
        result: { ok: true, data: { ops: [connectOp] } },
        children: [{ op_id: 'op-2', status: 'ok' }]
      })
    ]
  })

const twoTurns = (overrides: Partial<AssembleInput> = {}): AssembleInput =>
  input({
    raw: raw({
      turns: [raw().turns[0], secondTurn()],
      frames: [...frames(), ...secondTurnFrames()]
    }),
    rows: [rows(), secondRows()],
    ...overrides
  })

describe('assembleConversation across turns', () => {
  it('buckets frames by the message id of the turn that owns them', () => {
    const { conversation, receipt } = assembleConversation(twoTurns())

    expect(conversation.turns.map((turn) => turn.message_id)).toEqual([
      MESSAGE,
      MESSAGE_2
    ])
    expect(turnEventTypes(conversation.turns[0])).toEqual([
      'agent_thinking',
      'agent_active_tab',
      'agent_tool_call',
      'agent_message_done'
    ])
    expect(turnEventTypes(conversation.turns[1])).toEqual([
      'agent_thinking',
      'agent_tool_call',
      'agent_message_done'
    ])
    expect(conversation.turns[1].request.content).toBe(
      'Now connect it to the sampler.'
    )
    expect(receipt.turns.map((turn) => turn.message_id)).toEqual([
      MESSAGE,
      MESSAGE_2
    ])
    expect(receipt.turns.map((turn) => turn.frames_kept)).toEqual([4, 3])
  })

  it('exports one recorded conversation turn per recorded turn', () => {
    const { conversation } = assembleConversation(twoTurns())

    expect(conversation.turns.map((turn) => turn.message_id)).toEqual([
      MESSAGE,
      MESSAGE_2
    ])
    expect(
      conversation.turns.map(
        (turn) =>
          turn.response.filter((entry) => entry.kind === 'graph_ops').length
      )
    ).toEqual([1, 1])
  })

  it('requires the active tab frame only on the opening turn', () => {
    const { conversation } = assembleConversation(twoTurns())
    const tabFrames = (index: number) =>
      turnEvents(conversation.turns[index]).filter(
        (frame) => frame.type === 'agent_active_tab'
      )

    expect(tabFrames(0)).toHaveLength(1)
    expect(tabFrames(1)).toHaveLength(0)
  })

  it('checks the draft once, against every applied op of the thread', () => {
    expect(() =>
      assembleConversation(
        twoTurns({
          rows: [
            rows(),
            rows({
              parents: [
                parent({
                  id: 'parent-2',
                  tool_call_id: 'tool-2',
                  tool_name: 'delete_node',
                  result: {
                    ok: true,
                    data: {
                      ops: [{ op: 'delete_node', op_id: 'op-2', node_id: 4 }]
                    }
                  },
                  children: [{ op_id: 'op-2', status: 'ok' }]
                })
              ],
              draft: { nodes: [{ id: 3 }, { id: 4 }, { id: 10 }], links: [] }
            })
          ]
        })
      )
    ).toThrow('still holds node ids 4')
  })

  it('refuses a turn that landed on another thread', () => {
    expect(() =>
      assembleConversation(
        twoTurns({
          raw: raw({
            turns: [
              raw().turns[0],
              secondTurn({
                accepted: {
                  status: 202,
                  body: { thread_id: 'thread-2', message_id: MESSAGE_2 }
                }
              })
            ],
            frames: [...frames(), ...secondTurnFrames()]
          })
        })
      )
    ).toThrow('turn 2 landed on thread thread-2')
  })

  it('refuses a turn whose audit rows were never read', () => {
    expect(() => assembleConversation(twoTurns({ rows: [rows()] }))).toThrow(
      'recorded 2 turn(s) but read 1 audit row set(s)'
    )
  })

  it('names the turn whose last kept frame is not the done frame', () => {
    expect(() =>
      assembleConversation(
        twoTurns({
          raw: raw({
            turns: [raw().turns[0], secondTurn()],
            frames: [...frames(), ...secondTurnFrames().slice(0, 2)]
          })
        })
      )
    ).toThrow('last kept frame of turn 2 is agent_tool_call')
  })
})

describe('zRowsDump', () => {
  const dump = (result: unknown, overrides: Record<string, unknown> = {}) => ({
    source: 'postgres',
    parents: [
      {
        id: 'parent-1',
        tool_call_id: 'tool-1',
        tool_name: 'apply_ops',
        status: 'ok',
        workflow_id: WORKFLOW,
        result,
        children: [],
        ...overrides
      }
    ],
    draft: null
  })

  it('decodes a result psql handed back as a JSON string', () => {
    const parsed = zRowsDump.parse(
      dump(JSON.stringify({ ok: true, data: { ops: [addNodeOp] } }))
    )

    expect(parsed.parents[0].result).toEqual({
      ok: true,
      data: { ops: [addNodeOp] }
    })
  })

  it('decodes the draft column and normalises its node ids to strings', () => {
    const parsed = zRowsDump.parse({
      ...dump(null),
      draft: JSON.stringify({ nodes: [{ id: 3 }, { id: '4' }], links: [] })
    })

    expect(parsed.draft?.nodes.map((node) => node.id)).toEqual(['3', '4'])
  })

  it('refuses a result that is not a JSON object', () => {
    expect(() => zRowsDump.parse(dump([1, 2]))).toThrow()
  })

  it('refuses a result string that is not JSON', () => {
    expect(() => zRowsDump.parse(dump('{'))).toThrow('is not JSON')
  })

  it('refuses a parent row without a tool call id', () => {
    expect(() =>
      zRowsDump.parse(dump({ ok: true }, { tool_call_id: null }))
    ).toThrow()
  })

  it('refuses a dump that did not come from postgres', () => {
    expect(() =>
      zRowsDump.parse({ ...dump({ ok: true }), source: 'sqlite' })
    ).toThrow()
  })
})
