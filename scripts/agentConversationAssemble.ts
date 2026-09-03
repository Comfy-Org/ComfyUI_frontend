// The pure half of the recorder: the boundary schemas and every gate a
// recording must clear. Nothing here touches the network, a socket or disk.
import { basename } from 'node:path'

import { FROZEN_OPS } from '@comfyorg/comfy-multi-player'
import { z } from 'zod'

import type { zRecordedWsEvent } from '../browser_tests/fixtures/data/agent/agentConversation'
import { zAgentConversationWorkflow } from '../browser_tests/fixtures/data/agent/agentConversation'
import type { AgentBackendCapture } from './agentConversationCapture'

const REPLAYED_FRAMES =
  'agent_thinking agent_tool_call agent_message_delta agent_message_done agent_active_tab'.split(
    ' '
  )

// boundary.Classify's ActionEdit set minus the tab tools, which move focus
// rather than the document.
// boundary.Classify's ActionEdit set minus the tab tools, which move focus
// rather than the document.
const MUTATING_TOOLS =
  'apply_ops add_node connect set_widget delete_node delete_nodes clear_canvas apply_recipe generate_workflow reset_doc open_workflow get_template use_asset_as_input'.split(
    ' '
  )

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STACK =
  'NON-standalone local full stack (Postgres + doc host, M2M identity headers)'

export const zJsonObject = z.record(z.string(), z.unknown())

// psql hands a json column back as an object, as a string, or as NULL.
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

export const zAck = z.object({
  thread_id: z.string().min(1),
  message_id: z.string().min(1)
})

export const zSeedFixture = z.object({
  workflow: zAgentConversationWorkflow
})

const zChildRow = z
  .object({
    op_id: z.string().nullable(),
    status: z.string().nullable()
  })
  .superRefine((child, ctx) => {
    if (child.status === 'ok' && !child.op_id?.trim())
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['op_id'],
        message: 'must be non-empty when status is ok'
      })
  })

const zParentRow = z.object({
  id: z.coerce.string(),
  tool_call_id: z.string().min(1),
  tool_name: z.string().nullable(),
  status: z.string().nullable(),
  workflow_id: z.string().nullable(),
  result: zJsonColumn.pipe(zJsonObject.nullable()),
  children: z.array(zChildRow)
})

export const zRowsDump = z.object({
  source: z.literal('postgres'),
  parents: z.array(zParentRow),
  draft: zJsonColumn.pipe(
    z
      .object({ nodes: z.array(z.object({ id: z.coerce.string() })) })
      .passthrough()
      .nullable()
  )
})

// The socket carries frames without a data object; the replay union does not.
// The exporter's candidate set: data.ops when it is a list, else data.op.
const zOpsCarrier = z.object({
  data: z
    .object({ ops: z.array(z.unknown()).optional().catch(undefined) })
    .passthrough()
})

export type RecordedFrame = z.infer<typeof zRecordedWsEvent>
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
  saw_done: boolean
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
  rows_artifacts: string[]
  retrieval: Record<string, string> | null
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
  unexplained_draft_nodes: number
}

export interface TurnIds {
  threadId: string
  messageId: string
}

// A refused recording is an expected outcome: main logs it and exits 1.
// A refused recording is an expected outcome: main logs it and exits 1.
export class RecordRefusal extends Error {}

export function refuse(reason: string): never {
  throw new RecordRefusal(reason)
}

// A shape mismatch at a boundary is a refusal, named by its json path.
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
// Everything the recording as a whole must clear before a turn means anything.
function checkRecording(
  raw: RawCapture,
  seedIds: Set<string>,
  rowSets: number
): void {
  if (!/^[A-Za-z0-9_-]+$/.test(raw.attempt))
    refuse(`attempt label ${JSON.stringify(raw.attempt)} is not [A-Za-z0-9_-]+`)
  const driverIds = new Set(raw.seed_node_ids.map(String))
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

function turnIds(turn: RecordedTurn, label: string, raw: RawCapture): TurnIds {
  if (turn.accepted?.status !== 202)
    refuse(`${label} not accepted: ${JSON.stringify(turn.accepted)}`)
  const ack = zAck.safeParse(turn.accepted.body)
  if (!ack.success)
    refuse(
      `${label} ack without ids: ${JSON.stringify(turn.accepted.body ?? {})}`
    )
  if (!turn.saw_done)
    refuse(
      `${label}: agent_message_done never arrived (timed_out=${raw.timed_out}, error=${raw.error})`
    )
  return { threadId: ack.data.thread_id, messageId: ack.data.message_id }
}

function keepTurnFrames(
  frames: RecordedFrame[],
  ids: TurnIds[],
  seedTurn: TurnIds | null
): { kept: RecordedFrame[][]; dropped: Record<string, number> } {
  const kept: RecordedFrame[][] = ids.map(() => [])
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
    else if (REPLAYED_FRAMES.includes(type)) kept[turn].push(frame)
    else if (type.startsWith('agent_'))
      refuse(`frame type ${type} is outside the replay union`)
    else drop(`type:${type}`)
  }

  if (dropped.unparseable)
    refuse(`${dropped.unparseable} unparseable socket payload(s) recorded`)
  for (const [index, turn] of kept.entries()) {
    const last = turn.at(-1)
    if (last?.type !== 'agent_message_done')
      refuse(
        `last kept frame of ${turnLabel(index)} is ${last?.type}, not agent_message_done`
      )
  }
  return { kept, dropped }
}

function activeWorkflowId(
  kept: RecordedFrame[],
  seededId: string | null
): string {
  const tabs = new Set(
    kept
      .filter((frame) => frame.type === 'agent_active_tab')
      .map((frame) => frame.data.workflow_id)
  )
  if (tabs.size === 0) refuse('no agent_active_tab frame in this turn')
  if (tabs.size > 1)
    refuse(`agent_active_tab frames disagree on workflow_id: ${list(tabs)}`)
  const [tab] = [...tabs]
  const workflowId = z.string().regex(UUID).safeParse(tab)
  if (!workflowId.success)
    refuse(`active_tab workflow id is not a uuid: ${String(tab)}`)
  if (workflowId.data !== seededId)
    refuse(
      `active_tab workflow ${workflowId.data} is not the seeded workflow ${seededId}`
    )
  return workflowId.data
}

// Every op the exporter will read out of this result, shape-checked once.
// Every op the exporter will read out of this result, shape-checked once.
function echoedOps(row: ParentRow): Array<Record<string, unknown>> {
  const carrier = zOpsCarrier.safeParse(row.result ?? {})
  if (!carrier.success) return []
  const { data } = carrier.data
  const ops = z
    .array(zJsonObject)
    .safeParse(data.ops ?? ('op' in data ? [data.op] : []))
  if (!ops.success) refuse(`parent row ${row.id} echoes a non-object op entry`)
  const kinds = ops.data.map((op) => String(op.op))
  const offFrozen = new Set(
    kinds.filter((kind) => !(FROZEN_OPS as readonly string[]).includes(kind))
  )
  if (offFrozen.size > 0)
    refuse(
      `parent row ${row.id} echoes op kinds ${list(offFrozen)} outside the exporter frozen set`
    )
  return ops.data
}

// Ops-shaped mutation record: the CRDT-on op echo or the CRDT-off ack summary.
// Bare count keys are excluded because read tools carry them.
// Ops-shaped mutation record: the CRDT-on op echo or the CRDT-off ack summary.
// Bare count keys are excluded because read tools carry them.
function mutationReported(row: ParentRow): boolean {
  const carrier = zOpsCarrier.safeParse(row.result ?? {})
  if (!carrier.success) return false
  const { data } = carrier.data
  return (
    (data.ops?.length ?? 0) > 0 ||
    zJsonObject.safeParse(data.op).success ||
    Boolean(data.ops_by_kind ?? data.nodes_added ?? data.nodes_deleted)
  )
}

function appliedOps(
  row: ParentRow,
  applied: string[]
): Array<Record<string, unknown>> {
  const byId = new Map(
    echoedOps(row).flatMap((op) => {
      const opId = z.string().safeParse(op.op_id)
      return opId.success ? [[opId.data, op] as const] : []
    })
  )
  const missing = applied.filter((opId) => !byId.has(opId))
  if (missing.length > 0)
    refuse(
      `parent row ${row.id} applied op ids ${missing.join(', ')} are not echoed in its result`
    )
  const ops = applied.map((opId) => byId.get(opId)!)
  // A node id of 0 is a real id, so only a missing one refuses.
  if (
    ops.some((op) => op.op === 'delete_node' && (op.node_id ?? null) === null)
  )
    refuse(`parent row ${row.id} has an applied delete_node without node_id`)
  return ops
}

function parentToolCall(
  row: ParentRow,
  workflowId: string
): {
  toolCall: AgentBackendCapture['turns'][number]['tool_calls'][number]
  appliedOps: Array<Record<string, unknown>>
} {
  const applied = row.children.flatMap((child) =>
    child.status === 'ok' && child.op_id ? [child.op_id] : []
  )
  if (row.result === null && applied.length > 0)
    refuse(`parent row ${row.id} has applied ops but a NULL result`)
  if (
    row.tool_name !== null &&
    MUTATING_TOOLS.includes(row.tool_name) &&
    mutationReported(row) &&
    row.children.length === 0
  )
    refuse(
      `parent row ${row.id} (${row.tool_name}) reports a document mutation but has NO audit child rows`
    )

  if (applied.length > 0 && row.workflow_id !== workflowId)
    refuse(
      `parent row ${row.id} applied ops on ${row.workflow_id}, not the seeded workflow ${workflowId}`
    )

  return {
    appliedOps: appliedOps(row, applied),
    toolCall: {
      tool_call_id: row.tool_call_id,
      result: row.result ?? {},
      applied_op_ids: applied
    }
  }
}

// The frames and the audit rows must describe the same turn's tool calls.
// The frames and the audit rows must describe the same turn's tool calls.
function checkTurnAgreement(
  kept: RecordedFrame[],
  rows: ParentRow[],
  label: string
): void {
  const frameCalls = new Set(
    kept
      .filter(
        (frame) =>
          frame.type === 'agent_tool_call' && frame.data.status !== 'running'
      )
      .flatMap(
        (frame) => z.string().safeParse(frame.data.tool_call_id).data ?? []
      )
  )
  const rowCalls = new Set(rows.map((row) => row.tool_call_id))
  if (!sameSet(frameCalls, rowCalls))
    refuse(
      `${label}: frames ${list(frameCalls)} and audit parent rows ${list(rowCalls)} disagree; the rows are not this turn`
    )
}

// The draft is the only witness that the applied ops reached the document.
// The draft is the only witness that the applied ops reached the document.
function checkDraft(
  draft: NormalizedRows['draft'],
  seedIds: Set<string>,
  appliedOps: Array<Record<string, unknown>>,
  workflowId: string
): DraftCounts {
  if (draft === null)
    refuse(`no workflow_drafts row for ${workflowId}: the seed did not bind`)
  const draftIds = new Set(draft.nodes.map((node) => node.id))
  const nodeIds = (kind: string): Set<string> =>
    new Set(
      appliedOps
        .filter((op) => op.op === kind && (op.node_id ?? null) !== null)
        .map((op) => String(op.node_id))
    )

  const deleted = nodeIds('delete_node')
  const added = nodeIds('add_node')
  const expected = [...seedIds].filter((id) => !deleted.has(id))
  const missing = expected.filter((id) => !draftIds.has(id))
  if (missing.length > 0)
    refuse(
      `draft for ${workflowId} lacks seed node ids ${list(missing)} that no applied delete_node removed`
    )
  const undeleted = [...deleted].filter((id) => draftIds.has(id))
  if (undeleted.length > 0)
    refuse(
      `draft for ${workflowId} still holds node ids ${list(undeleted)} that applied delete_node ops removed`
    )

  return {
    draft_nodes: draftIds.size,
    added_nodes: added.size,
    deleted_nodes: deleted.size,
    unexplained_draft_nodes: [...draftIds].filter(
      (id) => !expected.includes(id) && !added.has(id)
    ).length
  }
}

// An uncatalogued class is stored opaquely by the applier, so a later
// set_widget on it throws.
// An uncatalogued class is stored opaquely by the applier, so a later
// set_widget on it throws.
function checkAddedClasses(
  appliedOps: Array<Record<string, unknown>>,
  catalog: SeedFixture['workflow']['catalog']
): void {
  const types = new Set(Object.keys(catalog.types))
  const offCatalog = new Set(
    appliedOps
      .filter((op) => op.op === 'add_node')
      .map((op) => String(op.class_type))
      .filter((type) => !types.has(type))
  )
  if (offCatalog.size > 0)
    refuse(
      `applied add_node classes ${list(offCatalog)} are not in the seed catalog ${list(types)}`
    )
}

function buildCapture(options: {
  input: AssembleInput
  threadId: string
  workflowId: string
  seedMessageId: string | null
  turns: AgentBackendCapture['turns']
}): AgentBackendCapture {
  const { input, threadId, workflowId, turns } = options
  const { raw, rows, provenance } = input
  const { workflow } = input.seed.json
  const note = `RECORDED from Comfy-Org/cloud services/agent running ${STACK} at ${raw.base} (frames: ${raw.frame_source}); NOT a production capture. cloud commit ${provenance.cloudSha}; model ${provenance.model}; thread ${threadId}; messages ${turns.map((turn) => turn.message_id).join(', ')}; workflow ${workflowId} (seeded by throwaway turn ${options.seedMessageId}; turn 1 opens on a fresh workflow and switches to it first because the replay subscribes only on an agent_active_tab frame); agent_tool_calls parent rows ${list(rows.flatMap((set) => set.parents.map((row) => row.id)))}; rows ${rows.map((set) => basename(set.path)).join(', ')}; raw capture sha256 ${input.rawSha256}`

  return {
    schema_version: 'agent-backend-capture.v2',
    source: {
      repo: 'Comfy-Org/ComfyUI_frontend',
      suite: 'agent',
      case_id: raw.case_id,
      note
    },
    capture: {
      backend: 'Comfy-Org/cloud',
      thread_id: threadId,
      exported_at: provenance.exportedAt
    },
    workflow: {
      id: workflowId,
      name: workflow.name,
      catalog: workflow.catalog,
      seed: workflow.seed
    },
    turns
  }
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

// One recorded turn: its own frames, its own rows, and the gates binding them.
// One recorded turn: its own frames, its own rows, and the gates binding them.
function assembleTurn(
  turn: RecordedTurn,
  ids: TurnIds,
  frames: RecordedFrame[],
  rows: NormalizedRows,
  workflowId: string,
  label: string
): {
  capture: AgentBackendCapture['turns'][number]
  receipt: TurnReceipt
  appliedOps: Array<Record<string, unknown>>
} {
  const calls = rows.parents.map((row) => parentToolCall(row, workflowId))
  checkTurnAgreement(frames, rows.parents, label)
  const sent = turn.cancel_sent_at_ms
  const before =
    sent === undefined
      ? []
      : frames.filter((frame) => (frame.at_ms ?? 0) <= sent)
  if (sent !== undefined && turn.cancel_ack?.status !== 202)
    refuse(
      `${label} cancel was not accepted: ${JSON.stringify(turn.cancel_ack ?? null)}`
    )
  if (sent !== undefined && before.length === 0)
    refuse(`${label} was cancelled before any frame arrived`)
  return {
    capture: {
      message_id: ids.messageId,
      request: { content: turn.prompt },
      frames,
      cancel_after_frame: sent === undefined ? undefined : before.length - 1,
      tool_calls: calls.map((call) => call.toolCall)
    },
    receipt: {
      message_id: ids.messageId,
      frames_kept: frames.length,
      cancel_after_frame: sent === undefined ? undefined : before.length - 1,
      parents: rows.parents.length,
      mutating_parents: calls.filter((call) => call.appliedOps.length > 0)
        .length,
      child_statuses: childStatuses(rows.parents),
      rows: rows.path,
      rows_sha256: rows.sha256
    },
    appliedOps: calls.flatMap((call) => call.appliedOps)
  }
}

export function assembleCapture(input: AssembleInput) {
  const { raw, rows } = input
  const { workflow } = input.seed.json
  const seedIds = new Set(workflow.seed.nodes.map((node) => String(node.id)))
  checkRecording(raw, seedIds, rows.length)

  const seedAck = zAck.safeParse(raw.seed_turn?.body)
  const seedTurn = seedAck.success
    ? { threadId: seedAck.data.thread_id, messageId: seedAck.data.message_id }
    : null
  const ids = raw.turns.map((turn, index) =>
    turnIds(turn, turnLabel(index), raw)
  )
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

  const appliedOps = turns.flatMap((turn) => turn.appliedOps)
  const draft = checkDraft(rows.at(-1)!.draft, seedIds, appliedOps, workflowId)
  checkAddedClasses(appliedOps, workflow.catalog)

  return {
    capture: buildCapture({
      input,
      threadId,
      workflowId,
      seedMessageId: seedTurn?.messageId ?? null,
      turns: turns.map((turn) => turn.capture)
    }),
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
