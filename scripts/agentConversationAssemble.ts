// The pure half of the recorder: the boundary schemas and every gate a
// recording must clear. Nothing here touches the network, a socket or disk.
import { basename } from 'node:path'

import { isEqual } from 'es-toolkit'
import { z } from 'zod'

import type {
  AgentConversation,
  zAgentConversationRequest
} from '../browser_tests/fixtures/data/agent/agentConversation'
import {
  OP_ENVELOPE_KEYS,
  assertOpsApply,
  mintedIds,
  zAgentConversation,
  zAgentConversationWorkflow
} from '../browser_tests/fixtures/data/agent/agentConversation'
import type { HostDoc } from '../browser_tests/fixtures/agentConversationHostDoc'
import type { AgentWsEvent } from '../src/workbench/extensions/agent/schemas/agentApiSchema'
import {
  AGENT_WS_EVENT_TYPES,
  zAgentTurnAccepted,
  zAgentWsEvent
} from '../src/workbench/extensions/agent/schemas/agentApiSchema'

const STACK =
  'NON-standalone local full stack (Postgres + doc host, M2M identity headers)'

export const zJsonObject = z.record(z.string(), z.unknown())

// psql hands a json column back as an object, as a string, or as NULL.
const zJsonColumn = z.unknown().transform((value, ctx) => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'is not JSON' })
    return z.NEVER
  }
})

export const zSeedFixture = z.object({
  workflow: zAgentConversationWorkflow
})

const zParentRow = z.object({
  id: z.coerce.string(),
  tool_call_id: z.string().min(1),
  tool_name: z.string().nullable(),
  status: z.string().nullable(),
  workflow_id: z.string().nullable(),
  result: zJsonColumn.pipe(zJsonObject.nullable()),
  children: z.array(
    z.object({
      op_id: z.string().nullable(),
      status: z.string().nullable()
    })
  )
})

// The draft is the doc host's projection as the cloud cached it, so it is read
// as one: every node's class and widget values, and every link tuple.
const zDraftNode = z
  .object({
    id: z.coerce.string(),
    type: z.string(),
    widgets_values: z.unknown().optional()
  })
  .passthrough()

export const zRowsDump = z.object({
  source: z.literal('postgres'),
  parents: z.array(zParentRow),
  draft: zJsonColumn.pipe(
    z
      .object({ nodes: z.array(zDraftNode), links: z.array(z.unknown()) })
      .passthrough()
      .nullable()
  )
})

// The candidate set: data.ops when it is a list, else data.op.
const zOpsCarrier = z.object({
  data: z
    .object({ ops: z.array(z.unknown()).optional().catch(undefined) })
    .passthrough()
})

// Every socket frame the recorder saw, agent event or not; zAgentConversation
// narrows the kept ones to the production event union.
export interface RecordedFrame {
  type: string
  data: Record<string, unknown>
  at_ms?: number
}
// A frame the replay carries: the production parse of one agent event.
interface KeptFrame {
  event: AgentWsEvent
  at_ms: number | undefined
}
type GraphOps = Array<Record<string, unknown>>

// What the assembler hands to zAgentConversation, which narrows the op payloads.
type DraftEntry =
  | { kind: 'event'; event: RecordedFrame; at_ms?: number }
  | { kind: 'graph_ops'; ops: GraphOps; at_ms?: number }

interface DraftTurn {
  message_id: string
  request: z.input<typeof zAgentConversationRequest>
  cancel_after: number | undefined
  response: DraftEntry[]
}
export type SeedFixture = z.infer<typeof zSeedFixture>
export type ParentRow = z.infer<typeof zParentRow>

export type NormalizedRows = Omit<z.infer<typeof zRowsDump>, 'source'> & {
  retrieval: Record<string, string>
  path: string
  sha256: string
}

export interface TurnAck {
  status: number
  body: unknown
}

export interface RecordedTurn {
  prompt: string
  accepted: TurnAck | null
  cancel_sent_at_ms?: number
  cancel_ack?: TurnAck | null
}

export interface RawCapture {
  case_id: string
  attempt: string
  base: string
  frame_source: string
  channel: string
  seed_sha256: string
  seed_name: string
  seed_node_ids: Array<string | number>
  saw_stream: boolean
  stream_closed: boolean
  seed_turn: TurnAck | null
  seed_workflow_id: string | null
  turns: RecordedTurn[]
  timed_out: boolean
  frames: RecordedFrame[]
  error: string | null
}

export interface AssembleInput {
  raw: RawCapture
  rows: NormalizedRows[]
  seed: { json: SeedFixture; path: string; sha256: string }
  provenance: { cloudSha: string; model: string; exportedAt: string }
  rawSha256: string
  rawPath: string
}

interface DraftCounts {
  draft_nodes: number
  added_nodes: number
  deleted_nodes: number
}

export interface TurnIds {
  threadId: string
  messageId: string
}

// A refused recording is an expected outcome: main logs it and exits 1.
export class RecordRefusal extends Error {}

export function refuse(reason: string): never {
  throw new RecordRefusal(reason)
}

// A shape mismatch at a boundary is a refusal, named by its json path.
export function parseOrRefuse<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
  what: string
): z.output<S> {
  const parsed = schema.safeParse(value)
  if (!parsed.success)
    refuse(
      `${what}: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
        .join('; ')}`
    )
  return parsed.data
}

const list = (values: Iterable<unknown>): string =>
  [...values].map(String).sort().join(', ')

const sameSet = (left: Set<string>, right: Set<string>): boolean =>
  left.size === right.size && [...left].every((value) => right.has(value))

export const turnLabel = (index: number): string => `turn ${index + 1}`

// Everything the recording as a whole must clear before a turn means anything.
function checkRecording(
  raw: RawCapture,
  seedIds: Set<string>,
  rowSets: number
): void {
  if (!/^[A-Za-z0-9_-]+$/.test(raw.attempt))
    refuse(`attempt label ${JSON.stringify(raw.attempt)} is not [A-Za-z0-9_-]+`)
  const seeded = raw.seed_node_ids.map(String)
  const seededTwice = repeated(seeded)
  if (seededTwice.length > 0)
    refuse(`the driver seeded node ids ${list(seededTwice)} more than once`)
  const driverIds = new Set(seeded)
  if (!sameSet(driverIds, seedIds))
    refuse(
      `the driver seeded ${list(driverIds)} but the seed fixture given here has ${list(seedIds)}`
    )
  if (!raw.saw_stream) refuse('frame stream never opened')
  if (raw.turns.length === 0) refuse('no turns recorded')
  if (raw.turns.length !== rowSets)
    refuse(
      `recorded ${raw.turns.length} turn(s) but read ${rowSets} audit row set(s)`
    )
}

function turnIds(turn: RecordedTurn, label: string): TurnIds {
  if (turn.accepted?.status !== 202)
    refuse(`${label} not accepted: ${JSON.stringify(turn.accepted)}`)
  const ack = zAgentTurnAccepted.safeParse(turn.accepted.body)
  if (!ack.success)
    refuse(
      `${label} ack without ids: ${JSON.stringify(turn.accepted.body ?? {})}`
    )
  return { threadId: ack.data.thread_id, messageId: ack.data.message_id }
}

function keepTurnFrames(
  frames: RecordedFrame[],
  ids: TurnIds[],
  seedTurn: TurnIds | null
): { kept: KeptFrame[][]; dropped: Record<string, number> } {
  const kept: KeptFrame[][] = ids.map(() => [])
  const dropped: Record<string, number> = {}
  const drop = (bucket: string): void => {
    dropped[bucket] = (dropped[bucket] ?? 0) + 1
  }

  for (const frame of frames) {
    const { type, data } = frame
    const turn = ids.findIndex(
      (id) => data.thread_id === id.threadId && data.message_id === id.messageId
    )
    // Unparseable payloads belong to no turn; the heartbeat carries no ids.
    if (type === '__raw__' || type === 'draft_version')
      drop(type === '__raw__' ? 'unparseable' : 'type:draft_version')
    else if (turn === -1)
      drop(
        seedTurn !== null &&
          data.thread_id === seedTurn.threadId &&
          data.message_id === seedTurn.messageId
          ? 'seed_turn'
          : 'foreign'
      )
    else if ((AGENT_WS_EVENT_TYPES as ReadonlySet<string>).has(type))
      kept[turn].push({
        event: parseOrRefuse(
          zAgentWsEvent,
          { type, data },
          `${turnLabel(turn)} ${type} frame`
        ),
        at_ms: frame.at_ms
      })
    else drop(`type:${type}`)
  }

  if (dropped.unparseable)
    refuse(`${dropped.unparseable} unparseable socket payload(s) recorded`)
  for (const [index, turn] of kept.entries()) {
    const dones = turn.filter(
      ({ event }) => event.type === 'agent_message_done'
    ).length
    if (dones > 1)
      refuse(
        `${turnLabel(index)} carries ${dones} agent_message_done frames; exactly one closes a turn`
      )
    const last = turn.at(-1)
    if (last?.event.type !== 'agent_message_done')
      refuse(
        `last kept frame of ${turnLabel(index)} is ${last?.event.type}, not agent_message_done`
      )
  }
  return { kept, dropped }
}

function activeWorkflowId(kept: KeptFrame[], seededId: string | null): string {
  const tabs = new Set(
    kept.flatMap(({ event }) =>
      event.type === 'agent_active_tab' ? [event.data.workflow_id] : []
    )
  )
  if (tabs.size === 0) refuse('no agent_active_tab frame in this turn')
  if (tabs.size > 1)
    refuse(`agent_active_tab frames disagree on workflow_id: ${list(tabs)}`)
  const [tab] = [...tabs]
  if (tab !== seededId)
    refuse(`active_tab workflow ${tab} is not the seeded workflow ${seededId}`)
  return tab
}

// Every op the assembler will read out of this result, shape-checked once.
function echoedOps(row: ParentRow): Array<Record<string, unknown>> {
  const carrier = zOpsCarrier.safeParse(row.result ?? {})
  if (!carrier.success) return []
  const { data } = carrier.data
  const ops = z
    .array(zJsonObject)
    .safeParse(data.ops ?? ('op' in data ? [data.op] : []))
  if (!ops.success) refuse(`parent row ${row.id} echoes a non-object op entry`)
  return ops.data
}

// Ops-shaped mutation record: the CRDT-on op echo or the CRDT-off ack summary.
// Bare count keys are excluded because read tools carry them.
function appliedOps(
  row: ParentRow,
  applied: string[]
): Array<Record<string, unknown>> {
  const echoed = echoedOps(row).flatMap((op) => {
    const opId = z.string().safeParse(op.op_id)
    return opId.success ? [[opId.data, op] as const] : []
  })
  const twice = repeated(echoed.map(([opId]) => opId))
  if (twice.length > 0)
    refuse(
      `parent row ${row.id} echoes op ids ${list(twice)} more than once; an audit id names one operation`
    )
  const byId = new Map(echoed)
  const missing = applied.filter((opId) => !byId.has(opId))
  if (missing.length > 0)
    refuse(
      `parent row ${row.id} applied op ids ${missing.join(', ')} are not echoed in its result`
    )
  // The envelope is the wire's, not the operation's; the replay mints its own.
  return applied.map((opId) => {
    const op = { ...byId.get(opId)! }
    for (const key of OP_ENVELOPE_KEYS) delete op[key]
    return op
  })
}

const repeated = (values: string[]): string[] => [
  ...new Set(values.filter((value, index) => values.indexOf(value) !== index))
]

function parentToolCall(
  row: ParentRow,
  workflowId: string
): { toolCallId: string; appliedOps: GraphOps } {
  const applied = row.children.flatMap((child) =>
    child.status === 'ok' && child.op_id ? [child.op_id] : []
  )
  const repeatedIds = repeated(applied)
  if (repeatedIds.length > 0)
    refuse(
      `parent row ${row.id} applies op ids ${list(repeatedIds)} more than once; the replay would apply them once per child row`
    )
  if (row.result === null && applied.length > 0)
    refuse(`parent row ${row.id} has applied ops but a NULL result`)

  if (applied.length > 0 && row.workflow_id !== workflowId)
    refuse(
      `parent row ${row.id} applied ops on ${row.workflow_id}, not the seeded workflow ${workflowId}`
    )

  return { toolCallId: row.tool_call_id, appliedOps: appliedOps(row, applied) }
}

// The ops a call applied ride the frame that closed it.
const isTerminalToolCall = (
  event: AgentWsEvent
): event is Extract<AgentWsEvent, { type: 'agent_tool_call' }> =>
  event.type === 'agent_tool_call' && event.data.status !== 'running'

// The replay's view of one turn: its frames, and the ops it applied, in order.
// Frames belong to the turn (keepTurnFrames) and every row tool call has a
// terminal frame here (checkTurnAgreement), so neither is re-checked.
function buildResponse(
  frames: KeptFrame[],
  opsByToolCall: Map<string, GraphOps>,
  cancelAfterFrame: number | undefined
): { response: DraftEntry[]; cancelAfter: number | undefined } {
  const response: DraftEntry[] = []
  const entryOfFrame: number[] = []
  const firstAt = frames[0].at_ms

  for (const { event, at_ms: receivedAt } of frames) {
    const at_ms =
      firstAt === undefined || receivedAt === undefined
        ? undefined
        : receivedAt - firstAt
    const data: Record<string, unknown> = { ...event.data }
    for (const key of Object.keys(mintedIds)) delete data[key]

    if (isTerminalToolCall(event)) {
      const ops = opsByToolCall.get(event.data.tool_call_id)
      if (ops !== undefined && ops.length > 0)
        response.push({ kind: 'graph_ops', ops, at_ms })
    }
    response.push({ kind: 'event', event: { type: event.type, data }, at_ms })
    entryOfFrame.push(response.length - 1)
  }

  return {
    response,
    cancelAfter:
      cancelAfterFrame === undefined
        ? undefined
        : (entryOfFrame[cancelAfterFrame] ?? -1)
  }
}

// The frames and the audit rows must describe the same turn's tool calls, one
// terminal frame and one parent row each. Set equality alone hides multiplicity:
// a second terminal frame replays the call's ops again, and a second parent row
// is silently dropped from the replay while still counting toward the draft.
function checkTurnAgreement(
  kept: KeptFrame[],
  rows: ParentRow[],
  label: string
): void {
  const frameCalls = kept.flatMap(({ event }) =>
    isTerminalToolCall(event) ? [event.data.tool_call_id] : []
  )
  const repeatedFrames = repeated(frameCalls)
  if (repeatedFrames.length > 0)
    refuse(
      `${label}: tool calls ${list(repeatedFrames)} carry more than one terminal frame; the replay would apply their ops once per frame`
    )
  const rowCalls = rows.map((row) => row.tool_call_id)
  const repeatedRows = repeated(rowCalls)
  if (repeatedRows.length > 0)
    refuse(
      `${label}: audit parent rows repeat tool calls ${list(repeatedRows)}; only one operation list per call can be the turn's`
    )
  if (!sameSet(new Set(frameCalls), new Set(rowCalls)))
    refuse(
      `${label}: frames ${list(new Set(frameCalls))} and audit parent rows ${list(new Set(rowCalls))} disagree; the rows are not this turn`
    )
  // One id is a join key, not proof that both records describe the same call:
  // the frame and the row must also name the same tool and the same outcome.
  const frameById = new Map(
    kept.flatMap(({ event }) =>
      isTerminalToolCall(event) ? [[event.data.tool_call_id, event.data]] : []
    )
  )
  for (const row of rows) {
    const frame = frameById.get(row.tool_call_id)!
    const outcome = row.status === 'ok' ? 'success' : 'error'
    if (row.tool_name !== frame.tool_name || outcome !== frame.status)
      refuse(
        `${label}: tool call ${row.tool_call_id} is ${frame.tool_name} (${frame.status}) on the wire but ${row.tool_name} (${row.status}) in the audit row`
      )
  }
}

// The replay's own host after the emitted stream; a stream it refuses is a
// recording nobody can replay.
function replayHost(conversation: AgentConversation): HostDoc {
  try {
    return assertOpsApply(conversation)
  } catch (error) {
    refuse(
      `the replay rejects this recording: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

interface ProjectedNode {
  id: string
  type: string
  widgets_values: unknown
}

// The projection reduced to what a replay must reproduce: each node's class
// and widget values by id, and the link tuples as a sorted multiset.
function projectedState(workflow: {
  nodes: Array<{ id: string | number; type: string; widgets_values?: unknown }>
  links: unknown[]
}): { nodes: ProjectedNode[]; links: string[] } {
  return {
    nodes: workflow.nodes.map((node) => ({
      id: String(node.id),
      type: node.type,
      widgets_values: node.widgets_values ?? null
    })),
    links: workflow.links.map((link) => JSON.stringify(link)).sort()
  }
}

// The draft is the only witness that the applied ops reached the document,
// so it must agree with the replay's own projection on every node's class and
// widget values and on every link, not only on which nodes exist. Interior
// subgraph state and node layout stay outside this guarantee.
function checkDraft(
  draft: NormalizedRows['draft'],
  seedIds: Set<string>,
  host: HostDoc,
  workflowId: string
): DraftCounts {
  if (draft === null)
    refuse(`no workflow_drafts row for ${workflowId}: the seed did not bind`)
  const persisted = projectedState(draft)
  const replayed = projectedState(host.projection())
  const storedTwice = repeated(persisted.nodes.map((node) => node.id))
  if (storedTwice.length > 0)
    refuse(
      `draft for ${workflowId} holds node ids ${list(storedTwice)} more than once`
    )
  const stored = new Map(persisted.nodes.map((node) => [node.id, node]))
  const outcome = new Set(replayed.nodes.map((node) => node.id))
  if (!sameSet(new Set(stored.keys()), outcome))
    refuse(
      `draft for ${workflowId} holds node ids ${list(stored.keys()) || '(none)'} but the replayed ops leave ${list(outcome) || '(none)'}`
    )
  // Structural equality: a draft that crossed a JSON column may order object
  // keys differently, and that is not a different value.
  for (const node of replayed.nodes) {
    const kept = stored.get(node.id)!
    if (
      kept.type !== node.type ||
      !isEqual(kept.widgets_values, node.widgets_values)
    )
      refuse(
        `draft for ${workflowId} stores node ${node.id} as ${kept.type} ${JSON.stringify(kept.widgets_values)} but the replayed ops leave ${node.type} ${JSON.stringify(node.widgets_values)}`
      )
  }
  if (persisted.links.join('\n') !== replayed.links.join('\n'))
    refuse(
      `draft for ${workflowId} stores links ${persisted.links.join(', ') || '(none)'} but the replayed ops leave ${replayed.links.join(', ') || '(none)'}`
    )
  return {
    draft_nodes: stored.size,
    added_nodes: [...outcome].filter((id) => !seedIds.has(id)).length,
    deleted_nodes: [...seedIds].filter((id) => !outcome.has(id)).length
  }
}

function buildConversation(options: {
  input: AssembleInput
  threadId: string
  workflowId: string
  seedMessageId: string | null
  turns: DraftTurn[]
}) {
  const { input, threadId, workflowId, turns } = options
  const { raw, rows, provenance } = input
  const { workflow } = input.seed.json
  const note = `RECORDED from Comfy-Org/cloud services/agent running ${STACK} at ${raw.base} (frames: ${raw.frame_source}); NOT a production capture. cloud commit ${provenance.cloudSha}; model ${provenance.model}; thread ${threadId}; messages ${turns.map((turn) => turn.message_id).join(', ')}; workflow ${workflowId} (seeded by throwaway turn ${options.seedMessageId}; turn 1 opens on a fresh workflow and switches to it first because the replay subscribes only on an agent_active_tab frame); agent_tool_calls parent rows ${list(rows.flatMap((set) => set.parents.map((row) => row.id)))}; rows ${rows.map((set) => basename(set.path)).join(', ')}; raw capture sha256 ${input.rawSha256}`

  return parseOrRefuse(
    zAgentConversation,
    {
      schema_version: 'agent-conversation.v2',
      source: {
        repo: 'Comfy-Org/ComfyUI_frontend',
        suite: 'agent',
        case_id: raw.case_id,
        response_side: 'recorded',
        note,
        capture: {
          backend: 'Comfy-Org/cloud',
          thread_id: threadId,
          exported_at: provenance.exportedAt
        }
      },
      workflow: {
        id: workflowId,
        name: workflow.name,
        catalog: workflow.catalog,
        seed: workflow.seed
      },
      turns
    },
    'assembled conversation'
  )
}

interface TurnReceipt {
  message_id: string
  frames_kept: number
  cancel_after_frame?: number
  parents: number
  mutating_parents: number
  child_statuses: Record<string, number>
  rows: string
  rows_sha256: string
}

function buildReceipt(options: {
  input: AssembleInput
  threadId: string
  workflowId: string
  turns: TurnReceipt[]
  framesDropped: Record<string, number>
  draft: DraftCounts
}) {
  const { input, threadId, workflowId, turns } = options
  const { raw, rows, seed, provenance } = input
  return {
    attempt: raw.attempt,
    frame_source: raw.frame_source,
    channel: raw.channel,
    raw: input.rawPath,
    raw_sha256: input.rawSha256,
    seed: seed.path,
    seed_sha256: seed.sha256,
    retrieval: rows[0].retrieval,
    thread_id: threadId,
    workflow_id: workflowId,
    turns,
    frames_dropped: options.framesDropped,
    ...options.draft,
    cloud_sha: provenance.cloudSha,
    model: provenance.model
  }
}

function childStatuses(parents: ParentRow[]): Record<string, number> {
  const tally: Record<string, number> = {}
  for (const child of parents.flatMap((row) => row.children))
    tally[child.status ?? 'null'] = (tally[child.status ?? 'null'] ?? 0) + 1
  return tally
}

// Where an accepted cancel falls among the turn's frames; the conversation
// schema decides whether the replay can stop at that entry.
function cancelAfterFrame(
  turn: RecordedTurn,
  frames: KeptFrame[],
  label: string
): number | undefined {
  const sent = turn.cancel_sent_at_ms
  if (sent === undefined) return undefined
  if (turn.cancel_ack?.status !== 202)
    refuse(
      `${label} cancel was not accepted: ${JSON.stringify(turn.cancel_ack ?? null)}`
    )
  const stamps = frames.map((frame) => frame.at_ms)
  if (stamps.some((stamp) => stamp === undefined))
    refuse(`${label} was cancelled but its frames carry no at_ms to place it`)
  return (
    stamps.filter((stamp) => stamp !== undefined && stamp <= sent).length - 1
  )
}

// One recorded turn: its own frames, its own rows, and the gates binding them.
function assembleTurn(
  turn: RecordedTurn,
  ids: TurnIds,
  frames: KeptFrame[],
  rows: NormalizedRows,
  workflowId: string,
  label: string
): { turn: DraftTurn; receipt: TurnReceipt } {
  const calls = rows.parents.map((row) => parentToolCall(row, workflowId))
  checkTurnAgreement(frames, rows.parents, label)
  const cancelAfterIndex = cancelAfterFrame(turn, frames, label)
  const { response, cancelAfter } = buildResponse(
    frames,
    new Map(calls.map((call) => [call.toolCallId, call.appliedOps])),
    cancelAfterIndex
  )
  return {
    turn: {
      message_id: ids.messageId,
      request: { content: turn.prompt },
      cancel_after: cancelAfter,
      response
    },
    receipt: {
      message_id: ids.messageId,
      frames_kept: frames.length,
      cancel_after_frame: cancelAfterIndex,
      parents: rows.parents.length,
      mutating_parents: calls.filter((call) => call.appliedOps.length > 0)
        .length,
      child_statuses: childStatuses(rows.parents),
      rows: rows.path,
      rows_sha256: rows.sha256
    }
  }
}

export function assembleConversation(input: AssembleInput) {
  const { raw, rows } = input
  const { workflow } = input.seed.json
  const seedIds = new Set(workflow.seed.nodes.map((node) => String(node.id)))
  checkRecording(raw, seedIds, rows.length)

  const seedAck = zAgentTurnAccepted.safeParse(raw.seed_turn?.body)
  const seedTurn = seedAck.success
    ? { threadId: seedAck.data.thread_id, messageId: seedAck.data.message_id }
    : null
  const ids = raw.turns.map((turn, index) => turnIds(turn, turnLabel(index)))
  const { threadId } = ids[0]
  const strayed = ids.findIndex((id) => id.threadId !== threadId)
  if (strayed > 0)
    refuse(
      `${turnLabel(strayed)} landed on thread ${ids[strayed].threadId}, not ${threadId}`
    )

  const { kept, dropped } = keepTurnFrames(raw.frames, ids, seedTurn)
  // The replay subscribes once, so only the opening turn must switch tabs.
  const workflowId = activeWorkflowId(kept[0], raw.seed_workflow_id)
  const turns = raw.turns.map((turn, index) =>
    assembleTurn(
      turn,
      ids[index],
      kept[index],
      rows[index],
      workflowId,
      turnLabel(index)
    )
  )

  const conversation = buildConversation({
    input,
    threadId,
    workflowId,
    seedMessageId: seedTurn?.messageId ?? null,
    turns: turns.map((turn) => turn.turn)
  })
  // The draft agrees with the document the replay itself is left with.
  const draft = checkDraft(
    rows.at(-1)!.draft,
    seedIds,
    replayHost(conversation),
    workflowId
  )

  return {
    conversation,
    receipt: buildReceipt({
      input,
      threadId,
      workflowId,
      turns: turns.map((turn) => turn.receipt),
      framesDropped: dropped,
      draft
    })
  }
}
