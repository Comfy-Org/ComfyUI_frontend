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
import { HostDoc } from '../browser_tests/fixtures/agentConversationHostDoc'
import type { GraphOperation } from '../src/workbench/extensions/agent/crdt/graphOperations'
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

// The recorded terminal frame for tool-1 as the audit row will describe it.
const framesWithCall = (call: {
  tool_name?: string
  status?: string
}): RecordedFrame[] =>
  frames().map((frame) =>
    frame.type === 'agent_tool_call'
      ? { ...frame, data: { ...frame.data, ...call } }
      : frame
  )

const turnEvents = (turn: ConversationTurn): RecordedFrame[] =>
  turn.response.flatMap((entry) =>
    entry.kind === 'event' ? [entry.event] : []
  )

const turnEventTypes = (turn: ConversationTurn): string[] =>
  turnEvents(turn).map((event) => event.type)

const nodePayload = (id: number, type: string) => ({
  id,
  type,
  pos: [0, 0],
  size: [240, 86],
  mode: 0,
  flags: {},
  order: 0,
  inputs:
    type === 'KSampler'
      ? [{ name: 'latent_image', type: 'LATENT', link: null }]
      : [],
  outputs:
    type === 'KSampler' ? [{ name: 'LATENT', type: 'LATENT', links: [] }] : [],
  properties: {},
  widgets_values: type === 'KSampler' ? [20] : []
})

const seed = (): SeedFixture => ({
  workflow: {
    id: WORKFLOW,
    name: 'Text to image',
    catalog: { types: { KSampler: { widget_order: ['steps'] } } },
    seed: {
      nodes: [
        nodePayload(3, 'CheckpointLoaderSimple'),
        nodePayload(4, 'KSampler')
      ],
      links: []
    }
  }
})

const addNodeOp = {
  op: 'add_node',
  op_id: 'op-1',
  node_id: 10,
  class_type: 'KSampler',
  pos: [0, 0],
  node: nodePayload(10, 'KSampler')
}
// The same op as a recording carries it: the export drops the wire envelope.
const { op_id: _addNodeOpId, ...addNodeOpSemantic } = addNodeOp

type DraftNodes = Array<{ id: number | string; type: string }>

// What the cloud caches as the draft: the host's projection after the given
// op batches applied to the seed.
const projected = (...batches: GraphOperation[][]) => {
  const { workflow } = seed()
  const host = new HostDoc(workflow.id, workflow.seed, workflow.catalog)
  for (const batch of batches) host.apply(batch)
  return host.projection()
}

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
      }
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
    draft: projected([addNodeOpSemantic as GraphOperation]),
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

  it('refuses a cancel that landed before the first frame', () => {
    expect(() =>
      assembleConversation(
        input({
          raw: cancelledTurn({ status: 202, body: {} }, 1_699_999_999_000)
        })
      )
    ).toThrow(/cancel_after/)
  })

  it('refuses a cancel that landed once agent_message_done had arrived', () => {
    expect(() =>
      assembleConversation(
        input({
          raw: cancelledTurn({ status: 202, body: {} }, 1_700_000_000_300)
        })
      )
    ).toThrow('cancel_after must precede the final agent_message_done entry')
  })

  it('keeps a cancel that landed just before agent_message_done', () => {
    const { conversation } = assembleConversation(
      input({
        raw: cancelledTurn({ status: 202, body: {} }, 1_700_000_000_299)
      })
    )
    expect(conversation.turns[0].cancel_after).toBe(3)
    expect(conversation.turns[0].response.at(-1)).toMatchObject({
      event: { type: 'agent_message_done' }
    })
  })

  it('refuses a turn that carries two done frames, cancelled or not', () => {
    const twoDone = [
      ...frames(),
      turnFrame('agent_message_done', {}, 1_700_000_000_400)
    ]
    expect(() =>
      assembleConversation(input({ raw: raw({ frames: twoDone }) }))
    ).toThrow(
      'turn 1 carries 2 agent_message_done frames; exactly one closes a turn'
    )
    expect(() =>
      assembleConversation(
        input({
          raw: {
            ...cancelledTurn({ status: 202, body: {} }, 1_700_000_000_350),
            frames: twoDone
          }
        })
      )
    ).toThrow('carries 2 agent_message_done frames')
  })

  it('refuses to place a cancel among frames without receipt times', () => {
    expect(() =>
      assembleConversation(
        input({
          raw: {
            ...cancelledTurn({ status: 202, body: {} }, 1_700_000_000_200),
            frames: frames().map(({ type, data }) => ({ type, data }))
          }
        })
      )
    ).toThrow('carry no at_ms')
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
    expect(receipt).toMatchObject({ added_nodes: 1, deleted_nodes: 0 })
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
    ).toThrow(/status/)
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
        raw: raw({ frames: framesWithCall({ status: 'error' }) }),
        rows: rows({
          parents: [
            parent({
              status: 'error',
              children: [{ op_id: 'op-1', status: 'error' }]
            })
          ],
          draft: projected()
        })
      })
    )

    expect(receipt.turns[0].mutating_parents).toBe(0)
    expect(receipt.turns[0].child_statuses).toEqual({ error: 1 })
  })

  it('accepts a read tool that echoes ops without writing child rows', () => {
    const { conversation, receipt } = assembleConversation(
      input({
        raw: raw({ frames: framesWithCall({ tool_name: 'plan_path' }) }),
        rows: rows({
          parents: [
            parent({
              tool_name: 'plan_path',
              children: [],
              result: { ok: true, data: { ops: [addNodeOp] } }
            })
          ],
          draft: projected()
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

  it('refuses a widget write on an applied node outside the catalog', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({
                result: {
                  ok: true,
                  data: {
                    ops: [
                      {
                        ...addNodeOp,
                        class_type: 'LatentUpscaleBy',
                        node: nodePayload(10, 'LatentUpscaleBy')
                      },
                      {
                        op: 'set_widget',
                        op_id: 'op-2',
                        node_id: 10,
                        widget: 'scale_by',
                        value: 2,
                        old: null
                      }
                    ]
                  }
                },
                children: [
                  { op_id: 'op-1', status: 'ok' },
                  { op_id: 'op-2', status: 'ok' }
                ]
              })
            ]
          })
        })
      )
    ).toThrow('the replay rejects this recording')
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

  it('refuses audit rows that name another tool or outcome for a frame', () => {
    for (const disagreement of [
      { tool_name: 'different_tool' },
      { status: 'error', children: [{ op_id: 'op-1', status: 'error' }] }
    ])
      expect(() =>
        assembleConversation(
          input({ rows: rows({ parents: [parent(disagreement)] }) })
        )
      ).toThrow('on the wire but')
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

  it('refuses an applied op kind outside the frozen op set', () => {
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
                },
                children: [
                  { op_id: 'op-1', status: 'ok' },
                  { op_id: 'op-2', status: 'ok' }
                ]
              })
            ]
          })
        })
      )
    ).toThrow("received 'reset_doc'")
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

  it('drops and counts an agent frame type the replay does not carry', () => {
    const { receipt } = assembleConversation(
      input({
        raw: raw({
          frames: [
            turnFrame('agent_not_a_frame', {}, 1_700_000_000_050),
            ...frames()
          ]
        })
      })
    )
    expect(receipt.frames_dropped).toEqual({ 'type:agent_not_a_frame': 1 })
  })

  const setSteps = (value: number, opId = 'op-1') => ({
    op: 'set_widget',
    op_id: opId,
    node_id: 4,
    widget: 'steps',
    value
  })

  it('refuses a parent result that echoes one op id twice, in either order', () => {
    for (const ops of [
      [setSteps(30), setSteps(40)],
      [setSteps(40), setSteps(30)]
    ])
      expect(() =>
        assembleConversation(
          input({
            rows: rows({
              parents: [parent({ result: { ok: true, data: { ops } } })]
            })
          })
        )
      ).toThrow('echoes op ids op-1 more than once')
  })

  it('refuses a draft that keeps the node ids but not the widget value', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({ result: { ok: true, data: { ops: [setSteps(30)] } } })
            ],
            draft: projected()
          })
        })
      )
    ).toThrow(
      'stores node 4 as KSampler [20] but the replayed ops leave KSampler [30]'
    )
  })

  it('accepts a draft whose object widget value orders its keys differently', () => {
    const write = {
      ...setSteps(0),
      value: { x: 0, y: 0, width: 512, height: 512 }
    }
    const { op_id: _id, ...semantic } = write
    const draft = projected([semantic as GraphOperation])
    const sampler = draft.nodes.find((node) => String(node.id) === '4')!
    sampler.widgets_values = [{ height: 512, width: 512, y: 0, x: 0 }]
    const { receipt } = assembleConversation(
      input({
        rows: rows({
          parents: [parent({ result: { ok: true, data: { ops: [write] } } })],
          draft
        })
      })
    )
    expect(receipt).toMatchObject({ draft_nodes: 2, added_nodes: 0 })
  })

  it('refuses a draft that keeps the node ids but not the link', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({
                result: { ok: true, data: { ops: [addNodeOp, connectOp] } },
                children: [
                  { op_id: 'op-1', status: 'ok' },
                  { op_id: 'op-2', status: 'ok' }
                ]
              })
            ],
            draft: projected([addNodeOpSemantic as GraphOperation])
          })
        })
      )
    ).toThrow('stores links (none) but the replayed ops leave')
  })

  it('refuses a draft that holds one node id twice', () => {
    const twice = projected([addNodeOpSemantic as GraphOperation])
    const [first] = twice.nodes
    expect(() =>
      assembleConversation(
        input({
          rows: rows({ draft: { ...twice, nodes: [...twice.nodes, first] } })
        })
      )
    ).toThrow(`holds node ids ${first.id} more than once`)
  })

  it('refuses a driver that seeded one node id twice', () => {
    expect(() =>
      assembleConversation(input({ raw: raw({ seed_node_ids: [3, 4, 4] }) }))
    ).toThrow('seeded node ids 4 more than once')
  })

  it('refuses a draft that lost a seed node nothing deleted', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            draft: {
              nodes: [{ id: 3, type: 'CheckpointLoaderSimple' }],
              links: []
            }
          })
        })
      )
    ).toThrow('holds node ids 3 but the replayed ops leave 10, 3, 4')
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
    ).toThrow('holds node ids 10, 3, 4 but the replayed ops leave 4')
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

  const opsFrames = (order: string[]): RecordedFrame[] => [
    ...frames().slice(0, 2),
    ...order.map((toolCallId, index) =>
      turnFrame(
        'agent_tool_call',
        { tool_call_id: toolCallId, tool_name: 'apply_ops', status: 'success' },
        1_700_000_000_200 + index
      )
    ),
    turnFrame('agent_message_done', {}, 1_700_000_000_300)
  ]
  const deleteThenAddRows = () =>
    rows({
      parents: [
        parent({
          id: 'parent-1',
          tool_call_id: 'tool-1',
          result: {
            ok: true,
            data: { ops: [{ op: 'delete_node', op_id: 'op-d', node_id: 4 }] }
          },
          children: [{ op_id: 'op-d', status: 'ok' }]
        }),
        parent({
          id: 'parent-2',
          tool_call_id: 'tool-2',
          result: {
            ok: true,
            data: {
              ops: [
                {
                  ...addNodeOp,
                  op_id: 'op-a',
                  node_id: 4,
                  node: nodePayload(4, 'KSampler')
                }
              ]
            }
          },
          children: [{ op_id: 'op-a', status: 'ok' }]
        })
      ],
      draft: projected(
        [{ op: 'delete_node', node_id: 4, removed_links: [] }],
        [
          {
            ...addNodeOpSemantic,
            node_id: 4,
            node: nodePayload(4, 'KSampler')
          } as GraphOperation
        ]
      )
    })

  it('checks the draft against the emitted order, not the parent row order', () => {
    const { receipt } = assembleConversation(
      input({
        raw: raw({ frames: opsFrames(['tool-1', 'tool-2']) }),
        rows: deleteThenAddRows()
      })
    )
    expect(receipt).toMatchObject({ added_nodes: 0, deleted_nodes: 0 })

    expect(() =>
      assembleConversation(
        input({
          raw: raw({ frames: opsFrames(['tool-2', 'tool-1']) }),
          rows: deleteThenAddRows()
        })
      )
    ).toThrow('holds node ids 3, 4 but the replayed ops leave 3')
  })

  const clearRows = (draft: DraftNodes) =>
    rows({
      parents: [
        parent({
          result: {
            ok: true,
            data: {
              ops: [{ op: 'clear', op_id: 'op-1', removed_nodes: [3, 4] }]
            }
          }
        })
      ],
      draft: { nodes: draft, links: [] }
    })

  it('accepts the empty draft a clear leaves and refuses a stale one', () => {
    const { receipt } = assembleConversation(input({ rows: clearRows([]) }))
    expect(receipt).toMatchObject({
      draft_nodes: 0,
      added_nodes: 0,
      deleted_nodes: 2
    })

    expect(() =>
      assembleConversation(
        input({
          rows: clearRows([
            { id: 3, type: 'CheckpointLoaderSimple' },
            { id: 4, type: 'KSampler' }
          ])
        })
      )
    ).toThrow('holds node ids 3, 4 but the replayed ops leave (none)')
  })

  it('refuses a parent row that applies the same op id twice', () => {
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({
                children: [
                  { op_id: 'op-1', status: 'ok' },
                  { op_id: 'op-1', status: 'ok' }
                ]
              })
            ]
          })
        })
      )
    ).toThrow('applies op ids op-1 more than once')
  })

  it('refuses an applied op the replay applier rejects', () => {
    const { node: _node, ...withoutPayload } = addNodeOp
    expect(() =>
      assembleConversation(
        input({
          rows: rows({
            parents: [
              parent({ result: { ok: true, data: { ops: [withoutPayload] } } })
            ]
          })
        })
      )
    ).toThrow('malformed_op')
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

const connectOp = {
  op: 'connect',
  op_id: 'op-2',
  link_id: 1,
  from_node: 10,
  from_slot: 0,
  to_node: 4,
  to_slot: 0,
  link_type: 'LATENT'
}
const { op_id: _connectOpId, ...connectOpSemantic } = connectOp

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
    ],
    draft: projected(
      [addNodeOpSemantic as GraphOperation],
      [connectOpSemantic as GraphOperation]
    )
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

  it('exports one turn per recorded turn, the tab frame on the opening one only', () => {
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
                  tool_name: 'connect',
                  result: {
                    ok: true,
                    data: {
                      ops: [{ op: 'delete_node', op_id: 'op-2', node_id: 4 }]
                    }
                  },
                  children: [{ op_id: 'op-2', status: 'ok' }]
                })
              ],
              draft: projected([addNodeOpSemantic as GraphOperation])
            })
          ]
        })
      )
    ).toThrow('holds node ids 10, 3, 4 but the replayed ops leave 10, 3')
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
      draft: JSON.stringify({
        nodes: [
          { id: 3, type: 'CheckpointLoaderSimple' },
          { id: '4', type: 'KSampler' }
        ],
        links: []
      })
    })

    expect(parsed.draft?.nodes.map((node) => node.id)).toEqual(['3', '4'])
  })

  it('refuses a result that is not a JSON object', () => {
    expect(() => zRowsDump.parse(dump([1, 2]))).toThrow('received array')
  })

  it('refuses a result string that is not JSON', () => {
    expect(() => zRowsDump.parse(dump('{'))).toThrow('is not JSON')
  })

  it('refuses a parent row without a tool call id', () => {
    expect(() =>
      zRowsDump.parse(dump({ ok: true }, { tool_call_id: null }))
    ).toThrow('tool_call_id')
  })

  it('refuses a dump that did not come from postgres', () => {
    expect(() =>
      zRowsDump.parse({ ...dump({ ok: true }), source: 'sqlite' })
    ).toThrow('postgres')
  })
})
