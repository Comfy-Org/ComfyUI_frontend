#!/usr/bin/env tsx

import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { FROZEN_OPS } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { AgentBackendCapture } from './agentConversationCapture'
import { exportAgentConversation } from './agentConversationCapture'

const USAGE =
  'usage: pnpm exec tsx scripts/agentConversationRecord.ts <caseId> "<prompt>" <seedFixture.json> --out <fixture.json> [--work <dir>]'

const REPLAYED_FRAMES =
  'agent_thinking agent_tool_call agent_message_delta agent_message_done agent_active_tab'.split(
    ' '
  )

// boundary.Classify's ActionEdit set minus the tab tools, which move focus
// rather than the document.
const MUTATING_TOOLS =
  'apply_ops add_node connect set_widget delete_node delete_nodes clear_canvas apply_recipe generate_workflow reset_doc open_workflow get_template use_asset_as_input'.split(
    ' '
  )

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STACK =
  'NON-standalone local full stack (Postgres + doc host, M2M identity headers)'

export type Retrieval = Record<string, string>

export interface TurnAck {
  status: number
  body: Record<string, unknown> | null
}

export interface RecordedFrame {
  type: string
  data: Record<string, unknown>
  at_ms?: number
}

export interface RawCapture {
  case_id: string
  attempt: string
  prompt: string
  base: string
  frame_source: string
  channel: string
  seed_sha256: string
  seed_name: string
  seed_node_ids: unknown[]
  saw_stream: boolean
  stream_closed: boolean
  seed_turn: TurnAck | null
  seed_workflow_id: string | null
  accepted: TurnAck | null
  saw_done: boolean
  timed_out: boolean
  frames: RecordedFrame[]
  rows_artifact: string | null
  retrieval: Retrieval | null
  error: string | null
}

export interface ParentRow {
  id: string
  tool_call_id: string | null
  tool_name: string | null
  status: string | null
  workflow_id: string | null
  result: unknown
  children: Array<{ op_id: string | null; status: string | null }>
}

export interface NormalizedRows {
  parents: ParentRow[]
  draft: unknown
  retrieval: Retrieval
  path: string
  sha256: string
}

export interface SeedFixture {
  workflow: { name: string; catalog: WidgetCatalog; seed: WorkflowJSON }
}

export interface AssembleInput {
  raw: RawCapture
  rows: NormalizedRows
  seed: { json: SeedFixture; path: string; sha256: string }
  provenance: { cloudSha: string; model: string; exportedAt: string }
  rawSha256: string
  rawPath: string
}

interface TurnIds {
  threadId: string
  messageId: string
  workflowId: string
}

// A refused recording is an expected outcome: main logs it and exits 1.
export class RecordRefusal extends Error {}

function refuse(reason: string): never {
  throw new RecordRefusal(reason)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const list = (values: Iterable<unknown>): string =>
  [...values].map(String).sort().join(', ')

const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value)

const sameSet = (left: Set<string>, right: Set<string>): boolean =>
  left.size === right.size && [...left].every((value) => right.has(value))

function asJson(value: unknown, what: string): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (error) {
    refuse(`${what} is not JSON: ${String(error)}`)
  }
}

// Ops-shaped mutation record: the CRDT-on op echo or the CRDT-off ack summary.
// Bare count keys are excluded because read tools carry them.
function mutationReported(result: Record<string, unknown>): boolean {
  const data = result.data
  if (!isRecord(data)) return false
  if ((Array.isArray(data.ops) && data.ops.length > 0) || isRecord(data.op))
    return true
  return Boolean(data.ops_by_kind ?? data.nodes_added ?? data.nodes_deleted)
}

// The exporter's candidate set: every entry of data.ops when it is a list,
// else data.op whenever the key is present.
function echoedOps(result: Record<string, unknown>): unknown[] {
  const data = result.data
  if (!isRecord(data)) return []
  if (Array.isArray(data.ops)) return data.ops
  return 'op' in data ? [data.op] : []
}

const sha256 = (bytes: Buffer | string): string =>
  createHash('sha256').update(bytes).digest('hex')

const sha256OfFile = (path: string): string => sha256(readFileSync(path))

const writeJson = (path: string, value: unknown): void =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

export function assembleCapture(input: AssembleInput) {
  const { raw, rows, seed, provenance } = input
  const { attempt } = raw
  const workflow = seed.json.workflow

  if (!/^[A-Za-z0-9_-]+$/.test(attempt))
    refuse(`attempt label ${JSON.stringify(attempt)} is not [A-Za-z0-9_-]+`)

  const seedIds = new Set(workflow.seed.nodes.map((node) => String(node.id)))
  const driverIds = new Set(raw.seed_node_ids.map(String))
  if (!sameSet(driverIds, seedIds))
    refuse(
      `the driver seeded ${list(driverIds)} but the seed fixture given here has ${list(seedIds)}`
    )

  if (raw.accepted?.status !== 202)
    refuse(`recorded turn not accepted: ${JSON.stringify(raw.accepted)}`)
  const body = raw.accepted.body ?? {}
  const threadId = body.thread_id
  const messageId = body.message_id
  if (typeof threadId !== 'string' || typeof messageId !== 'string')
    refuse(`ack without ids: ${JSON.stringify(body)}`)
  if (!raw.saw_stream) refuse('frame stream never opened')
  if (!raw.saw_done)
    refuse(
      `agent_message_done never arrived (timed_out=${raw.timed_out}, error=${raw.error})`
    )

  const seedAck = raw.seed_turn?.body ?? {}
  const kept: RecordedFrame[] = []
  const dropped: Record<string, number> = {}
  const drop = (bucket: string): void => {
    dropped[bucket] = (dropped[bucket] ?? 0) + 1
  }

  for (const frame of raw.frames) {
    const { type, data } = frame
    // Unparseable payloads belong to no turn; the heartbeat carries no ids.
    if (type === '__raw__' || type === 'draft_version') {
      drop(type === '__raw__' ? 'unparseable' : 'type:draft_version')
      continue
    }
    if (data.thread_id !== threadId || data.message_id !== messageId) {
      const seedTurn =
        typeof seedAck.thread_id === 'string' &&
        data.thread_id === seedAck.thread_id &&
        data.message_id === seedAck.message_id
      drop(seedTurn ? 'seed_turn' : 'foreign')
      continue
    }
    if (!REPLAYED_FRAMES.includes(type)) {
      if (type.startsWith('agent_'))
        refuse(`frame type ${type} is outside the replay union`)
      drop(`type:${type}`)
      continue
    }
    kept.push(frame.at_ms === undefined ? { type, data } : frame)
  }

  if (dropped.unparseable)
    refuse(`${dropped.unparseable} unparseable socket payload(s) recorded`)
  const last = kept.at(-1)
  if (last?.type !== 'agent_message_done')
    refuse(`last kept frame is ${last?.type}, not agent_message_done`)

  const tabs = new Set(
    kept
      .filter((frame) => frame.type === 'agent_active_tab')
      .map((frame) => frame.data.workflow_id)
  )
  if (tabs.size === 0) refuse('no agent_active_tab frame in this turn')
  if (tabs.size > 1)
    refuse(`agent_active_tab frames disagree on workflow_id: ${list(tabs)}`)
  const workflowId = [...tabs][0]
  if (typeof workflowId !== 'string' || !UUID.test(workflowId))
    refuse(`active_tab workflow id is not a uuid: ${String(workflowId)}`)
  if (workflowId !== raw.seed_workflow_id)
    refuse(
      `active_tab workflow ${workflowId} is not the seeded workflow ${raw.seed_workflow_id}`
    )

  const toolCalls: AgentBackendCapture['tool_calls'] = []
  const childStatuses: Record<string, number> = {}
  const parentRows = rows.parents.map((parent) => {
    const { id, tool_name: tool } = parent
    if (!parent.tool_call_id) refuse(`parent row ${id} has NULL tool_call_id`)
    for (const child of parent.children) {
      const key = String(child.status)
      childStatuses[key] = (childStatuses[key] ?? 0) + 1
    }
    const applied = parent.children
      .filter((child) => child.status === 'ok' && child.op_id)
      .map((child) => String(child.op_id))

    const parsed = asJson(parent.result, `parent row ${id} result`)
    if ((parsed ?? null) === null && applied.length > 0)
      refuse(`parent row ${id} has applied ops but a NULL result`)
    const result = parsed ?? {}
    if (!isRecord(result))
      refuse(
        `parent row ${id} result is not an object; the exporter requires an object`
      )
    if (
      MUTATING_TOOLS.includes(String(tool)) &&
      mutationReported(result) &&
      parent.children.length === 0
    )
      refuse(
        `parent row ${id} (${tool}) reports a document mutation but has NO audit child rows`
      )

    const echoed = echoedOps(result)
    const nonObjects = echoed.filter((op) => !isRecord(op)).length
    if (nonObjects > 0)
      refuse(
        `parent row ${id} echoes ${nonObjects} non-object op entr${nonObjects === 1 ? 'y' : 'ies'}`
      )
    const ops = echoed.filter(isRecord)
    const offFrozen = new Set(
      ops
        .filter(
          (op) => !(FROZEN_OPS as readonly string[]).includes(String(op.op))
        )
        .map((op) => String(op.op))
    )
    if (offFrozen.size > 0)
      refuse(
        `parent row ${id} echoes op kinds ${list(offFrozen)} outside the exporter frozen set`
      )

    const byId = new Map(ops.map((op) => [String(op.op_id), op]))
    const missing = applied.filter((opId) => !byId.has(opId))
    if (missing.length > 0)
      refuse(
        `parent row ${id} applied op ids ${missing.join(', ')} are not echoed in its result`
      )
    if (applied.length > 0 && parent.workflow_id !== workflowId)
      refuse(
        `parent row ${id} applied ops on ${String(parent.workflow_id)}, not the seeded workflow ${workflowId}`
      )
    const appliedOps = applied.map((opId) => byId.get(opId)!)
    // A node id of 0 is a real id, so only a missing one refuses.
    if (
      appliedOps.some(
        (op) => op.op === 'delete_node' && (op.node_id ?? null) === null
      )
    )
      refuse(`parent row ${id} has an applied delete_node without node_id`)

    toolCalls.push({
      tool_call_id: parent.tool_call_id,
      result,
      applied_op_ids: applied
    })
    return {
      id,
      tool_name: tool,
      status: parent.status,
      workflow_id: parent.workflow_id,
      child_count: parent.children.length,
      applied_op_ids: applied,
      applied_op_kinds: appliedOps.map((op) => op.op),
      applied_ops: appliedOps
    }
  })

  const frameCalls = new Set(
    kept
      .filter(
        (frame) =>
          frame.type === 'agent_tool_call' && frame.data.status !== 'running'
      )
      .map((frame) => String(frame.data.tool_call_id))
  )
  const rowCalls = new Set(rows.parents.map((row) => String(row.tool_call_id)))
  if (!sameSet(frameCalls, rowCalls))
    refuse(
      `frames ${list(frameCalls)} and audit parent rows ${list(rowCalls)} disagree; the rows are not this turn`
    )

  if (rows.draft === null || rows.draft === undefined)
    refuse(`no workflow_drafts row for ${workflowId}: the seed did not bind`)
  const draft = asJson(rows.draft, `workflow_drafts.content for ${workflowId}`)
  const draftIds = new Set(
    (isRecord(draft) && Array.isArray(draft.nodes) ? draft.nodes : [])
      .filter(isRecord)
      .map((node) => String(node.id))
  )

  const appliedOps = parentRows.flatMap((row) => row.applied_ops)
  const opsOfKind = (kind: string): Array<Record<string, unknown>> =>
    appliedOps.filter((op) => op.op === kind)
  // An uncatalogued class is stored opaquely by the applier, so a later
  // set_widget on it throws.
  const catalogTypes = new Set(Object.keys(workflow.catalog.types))
  const offCatalog = new Set(
    opsOfKind('add_node')
      .filter((op) => !catalogTypes.has(String(op.class_type)))
      .map((op) => String(op.class_type))
  )
  if (offCatalog.size > 0)
    refuse(
      `applied add_node classes ${list(offCatalog)} are not in the seed catalog ${list(catalogTypes)}`
    )

  const deletedIds = new Set(
    opsOfKind('delete_node').map((op) => String(op.node_id))
  )
  const addedIds = new Set(
    opsOfKind('add_node')
      .filter((op) => (op.node_id ?? null) !== null)
      .map((op) => String(op.node_id))
  )
  const expectedIds = [...seedIds].filter((id) => !deletedIds.has(id))
  const missingSeed = expectedIds.filter((id) => !draftIds.has(id))
  if (missingSeed.length > 0)
    refuse(
      `draft for ${workflowId} lacks seed node ids ${list(missingSeed)} that no applied delete_node removed`
    )
  const undeleted = [...deletedIds].filter((id) => draftIds.has(id))
  if (undeleted.length > 0)
    refuse(
      `draft for ${workflowId} still holds node ids ${list(undeleted)} that applied delete_node ops removed`
    )

  const note = `RECORDED from Comfy-Org/cloud services/agent running ${STACK} at ${raw.base} (frames: ${raw.frame_source}); NOT a production capture. cloud commit ${provenance.cloudSha}; model ${provenance.model}; thread ${threadId}; message ${messageId}; workflow ${workflowId} (seeded by throwaway turn ${String(seedAck.message_id)}; the recorded turn opens on a fresh workflow and switches to it first because the replay subscribes only on an agent_active_tab frame); agent_tool_calls parent rows ${list(parentRows.map((row) => row.id))}; rows ${basename(rows.path)}; raw capture sha256 ${input.rawSha256}`

  const capture: AgentBackendCapture = {
    schema_version: 'agent-backend-capture.v1',
    source: {
      repo: 'Comfy-Org/ComfyUI_frontend',
      suite: 'agent',
      case_id: raw.case_id,
      note
    },
    capture: {
      backend: 'Comfy-Org/cloud',
      thread_id: threadId,
      message_id: messageId,
      exported_at: provenance.exportedAt
    },
    workflow: {
      id: workflowId,
      name: workflow.name,
      catalog: workflow.catalog,
      seed: workflow.seed
    },
    request: { content: raw.prompt },
    frames: kept,
    tool_calls: toolCalls
  }

  const receipt = {
    attempt,
    frame_source: raw.frame_source,
    channel: raw.channel,
    raw: input.rawPath,
    raw_sha256: input.rawSha256,
    seed: seed.path,
    seed_sha256: seed.sha256,
    seed_node_ids: [...seedIds].sort(),
    rows: rows.path,
    rows_sha256: rows.sha256,
    retrieval: rows.retrieval,
    thread_id: threadId,
    message_id: messageId,
    workflow_id: workflowId,
    start_workflow_id: body.workflow_id,
    seed_turn: raw.seed_turn,
    parent_rows: parentRows,
    child_statuses: childStatuses,
    frames_kept: kept.length,
    frames_dropped: dropped,
    kept_types: kept.map((frame) => frame.type),
    draft_node_ids: [...draftIds].sort(),
    deleted_node_ids: [...deletedIds].sort(),
    added_node_ids: [...addedIds].sort(),
    unexplained_draft_node_ids: [...draftIds]
      .filter((id) => !expectedIds.includes(id) && !addedIds.has(id))
      .sort(),
    catalog_types: [...catalogTypes].sort(),
    mutating_parents: parentRows
      .filter((row) => row.applied_op_ids.length > 0)
      .map((row) => row.id),
    cloud_sha: provenance.cloudSha,
    model: provenance.model
  }

  return { capture, receipt }
}

function readRows(exec: string[], path: string, ids: TurnIds): NormalizedRows {
  const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`
  const sql = `select json_build_object('source', 'postgres', 'parents', coalesce((select json_agg(row_to_json(r) order by r.started_at, r.id) from (select parent.id, parent.tool_call_id, parent.tool_name, parent.status, parent.result, parent.started_at, parent.workflow_id, coalesce(json_agg(json_build_object('op_id', child.op_id, 'status', child.status, 'op_index', child.op_index) order by child.op_index) filter (where child.id is not null), '[]'::json) as children from agent_tool_calls as parent left join agent_tool_calls as child on child.parent_call_id = parent.id where parent.thread_id = ${quote(ids.threadId)} and parent.message_id = ${quote(ids.messageId)} and parent.parent_call_id is null group by parent.id) r), '[]'::json), 'draft', (select content from workflow_drafts where workflow_id = ${quote(ids.workflowId)} limit 1))`
  const dump: unknown = JSON.parse(
    execFileSync(exec[0], [...exec.slice(1), sql], { encoding: 'utf8' }).trim()
  )
  if (!isRecord(dump) || dump.source !== 'postgres')
    refuse(`rows dump source is not 'postgres'`)
  writeJson(path, dump)
  return {
    parents: (Array.isArray(dump.parents) ? dump.parents : [])
      .filter(isRecord)
      .map((row) => ({
        id: String(row.id),
        tool_call_id: text(row.tool_call_id),
        tool_name: text(row.tool_name),
        status: text(row.status),
        workflow_id: text(row.workflow_id),
        result: row.result,
        children: (Array.isArray(row.children) ? row.children : [])
          .filter(isRecord)
          .map((child) => ({
            op_id: text(child.op_id),
            status: text(child.status)
          }))
      })),
    draft: dump.draft ?? null,
    retrieval: { kind: 'postgres-json', sql },
    path,
    sha256: sha256OfFile(path)
  }
}

function openStream(
  raw: RawCapture,
  redisExec: string[],
  onFrame: (frame: RecordedFrame) => void
): () => void {
  const push = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload)
      if (isRecord(parsed) && typeof parsed.type === 'string') {
        onFrame({
          type: parsed.type,
          data: isRecord(parsed.data) ? parsed.data : {}
        })
        return
      }
    } catch {
      // Falls through to the marker the assembler refuses on.
    }
    onFrame({ type: '__raw__', data: { payload } })
  }

  const child = spawn(
    redisExec[0],
    [...redisExec.slice(1), 'SUBSCRIBE', raw.channel],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  )
  child.stdout.setEncoding('utf8')
  child.on('error', (error) => {
    raw.error ??= `frame source failed to start: ${error.message}`
    raw.stream_closed = true
  })
  child.on('exit', () => (raw.stream_closed = true))
  // redis-cli off a tty prints subscribe/message envelopes one line at a time.
  let buffered = ''
  let pending = 0
  child.stdout.on('data', (chunk: string) => {
    buffered += chunk
    for (const line of buffered.split('\n').slice(0, -1)) {
      if (line === 'subscribe') raw.saw_stream = true
      else if (line === 'message') pending = 2
      else if (pending === 2) pending = 1
      else if (pending === 1) {
        pending = 0
        push(line)
      }
    }
    buffered = buffered.slice(buffered.lastIndexOf('\n') + 1)
  })
  return () => child.kill()
}

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms))

async function recordTurns(
  raw: RawCapture,
  options: {
    headers: Record<string, string>
    redisExec: string[]
    timeoutMs: number
    seed: WorkflowJSON
  }
): Promise<void> {
  const stop = openStream(raw, options.redisExec, (frame) =>
    raw.frames.push({ ...frame, at_ms: Date.now() })
  )

  const postTurn = async (turn: unknown): Promise<TurnAck> => {
    const response = await fetch(`${raw.base}/agent/threads/new/messages`, {
      method: 'POST',
      headers: options.headers,
      body: JSON.stringify(turn),
      signal: AbortSignal.timeout(30_000)
    })
    const payload = await response.text()
    const ack = ((): Record<string, unknown> | null => {
      try {
        const parsed: unknown = JSON.parse(payload)
        return isRecord(parsed) ? parsed : null
      } catch {
        return null
      }
    })()
    if (response.status === 202 && ack === null)
      refuse(`202 with a non-JSON body: ${payload.slice(0, 200)}`)
    return { status: response.status, body: ack }
  }

  const done = (messageId: unknown): boolean =>
    raw.frames.some(
      (frame) =>
        frame.type === 'agent_message_done' &&
        frame.data.message_id === messageId
    )

  const waitDone = async (messageId: unknown, label: string): Promise<void> => {
    const started = Date.now()
    while (
      !done(messageId) &&
      !raw.stream_closed &&
      Date.now() - started < options.timeoutMs
    )
      await sleep(250)
    await sleep(1_500)
    if (done(messageId)) return
    raw.timed_out = !raw.stream_closed
    refuse(
      raw.stream_closed
        ? `frame stream closed before the ${label} agent_message_done`
        : `no agent_message_done for the ${label} within ${options.timeoutMs}ms`
    )
  }

  try {
    const opened = Date.now()
    while (
      !raw.saw_stream &&
      !raw.stream_closed &&
      Date.now() - opened < 10_000
    )
      await sleep(100)
    if (!raw.saw_stream)
      refuse(`frame source did not open: ${raw.frame_source}`)

    // Turn A mints and seeds the workflow; it is thrown away, not recorded.
    const seedTurn = await postTurn({
      content:
        'Hello. Please do nothing to the workflow yet; just acknowledge.',
      draft: { content: options.seed }
    })
    raw.seed_turn = seedTurn
    const seedWorkflowId = seedTurn.body?.workflow_id
    if (seedTurn.status !== 202 || typeof seedWorkflowId !== 'string')
      refuse(`seed turn not accepted: ${JSON.stringify(seedTurn)}`)
    raw.seed_workflow_id = seedWorkflowId
    await waitDone(seedTurn.body?.message_id, 'seed turn')

    // Turn B opens on a fresh workflow so switch_tab publishes agent_active_tab.
    const recorded = await postTurn({
      content: raw.prompt,
      open_tabs: [{ workflow_id: seedWorkflowId, name: raw.seed_name }]
    })
    raw.accepted = recorded
    if (recorded.status !== 202 || !recorded.body?.message_id)
      refuse(`recorded turn not accepted: ${JSON.stringify(recorded)}`)
    await waitDone(recorded.body.message_id, 'recorded turn')
    raw.saw_done = true
    if (
      !raw.frames.some(
        (frame) =>
          frame.type === 'agent_active_tab' &&
          frame.data.message_id === recorded.body?.message_id &&
          frame.data.workflow_id === seedWorkflowId
      )
    )
      refuse(
        `no agent_active_tab for ${seedWorkflowId}: the agent never switched tabs`
      )
  } finally {
    stop()
  }
}

function readSeedFixture(path: string): SeedFixture {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  const workflow = isRecord(parsed) ? parsed.workflow : undefined
  const seed = isRecord(workflow) ? workflow.seed : undefined
  if (
    !isRecord(workflow) ||
    typeof workflow.name !== 'string' ||
    !isRecord(workflow.catalog) ||
    !isRecord(seed) ||
    !Array.isArray(seed.nodes) ||
    !Array.isArray(seed.links)
  )
    refuse(
      `seed fixture ${path} needs workflow.{name,catalog,seed.{nodes,links}}`
    )
  return parsed as SeedFixture
}

async function main(argv: string[]): Promise<void> {
  const positional: string[] = []
  const flags: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--out' || arg === '--work')
      flags[arg] = argv[(index += 1)] ?? ''
    else positional.push(arg)
  }
  const [caseId, prompt, seedPath] = positional
  const outPath = flags['--out']
  if (!caseId || !prompt || !seedPath || !outPath) throw new Error(USAGE)

  const env = (name: string, fallback = ''): string =>
    process.env[name] ?? fallback
  const cloudSha = env('AGENT_CLOUD_SHA')
  const model = env('AGENT_MODEL')
  if (!/^[0-9a-f]{7,40}$/.test(cloudSha) || model.trim() === '')
    throw new Error('AGENT_CLOUD_SHA (7-40 hex) and AGENT_MODEL are required')
  const secretFile = env('AGENT_M2M_SECRET_FILE')
  const workspace = env('AGENT_WORKSPACE_ID', env('REC_WORKSPACE_ID'))
  const user = env('AGENT_USER_ID', env('REC_USER_ID'))
  if (!secretFile || !workspace || !user)
    throw new Error(
      'AGENT_M2M_SECRET_FILE, AGENT_WORKSPACE_ID (or REC_WORKSPACE_ID) and AGENT_USER_ID (or REC_USER_ID) are required'
    )
  const timeoutMs = Number(env('AGENT_TURN_TIMEOUT', '180000'))
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error(`AGENT_TURN_TIMEOUT must be positive ms, got ${timeoutMs}`)
  const attempt = (
    env('AGENT_ATTEMPT').trim() ||
    new Date().toISOString().replace(/[:.]/g, '-')
  ).replace(/[^A-Za-z0-9_-]/g, '-')

  const seed = readSeedFixture(seedPath)
  // conversations/ is scanned for replay cases, so sidecars go one level down.
  const workDir = flags['--work'] || join(dirname(outPath), 'recordings')
  mkdirSync(workDir, { recursive: true })
  mkdirSync(dirname(resolve(outPath)), { recursive: true })
  const sidecar = (suffix: string): string =>
    join(workDir, `${caseId}.${attempt}.${suffix}`)
  const rawPath = sidecar('raw.json')

  const raw: RawCapture = {
    case_id: caseId,
    attempt,
    prompt,
    base: env('AGENT_FULLSTACK_URL', 'http://127.0.0.1:8086').replace(
      /\/$/,
      ''
    ),
    // The note carries this shape; the concrete channel stays in the receipt.
    frame_source: 'redis SUBSCRIBE channel:ws:<workspace>:u:<user>',
    channel: `channel:ws:${workspace}:u:${user}`,
    seed_sha256: sha256OfFile(seedPath),
    seed_name: seed.workflow.name,
    seed_node_ids: seed.workflow.seed.nodes.map((node) => node.id),
    saw_stream: false,
    stream_closed: false,
    seed_turn: null,
    seed_workflow_id: null,
    accepted: null,
    saw_done: false,
    timed_out: false,
    frames: [],
    rows_artifact: null,
    retrieval: null,
    error: null
  }

  try {
    await recordTurns(raw, {
      headers: {
        'content-type': 'application/json',
        'X-Comfy-M2M-Secret': readFileSync(secretFile, 'utf8').trim(),
        'X-Comfy-Workspace': workspace,
        'X-Comfy-User': user
      },
      redisExec: env(
        'AGENT_REDIS_EXEC',
        'docker exec -i be11470-redis redis-cli'
      ).split(' '),
      timeoutMs,
      seed: seed.workflow.seed
    })

    const rows = readRows(
      env(
        'AGENT_PG_EXEC',
        'docker exec -i be11470-pg psql -U postgres -d postgres -At -c'
      ).split(' '),
      sidecar('rows.json'),
      {
        threadId: String(raw.accepted?.body?.thread_id),
        messageId: String(raw.accepted?.body?.message_id),
        workflowId: String(raw.seed_workflow_id)
      }
    )
    raw.rows_artifact = rows.path
    raw.retrieval = rows.retrieval
    writeJson(rawPath, raw)

    const { capture, receipt } = assembleCapture({
      raw,
      rows,
      seed: { json: seed, path: seedPath, sha256: raw.seed_sha256 },
      provenance: { cloudSha, model, exportedAt: new Date().toISOString() },
      rawSha256: sha256OfFile(rawPath),
      rawPath
    })
    writeJson(sidecar('capture.json'), capture)
    writeJson(outPath, exportAgentConversation(capture))
    writeJson(sidecar('receipt.json'), receipt)
    process.stdout.write(
      `recorded ${outPath} sha256=${sha256OfFile(outPath)} attempt=${attempt} frames=${receipt.frames_kept} dropped=${JSON.stringify(receipt.frames_dropped)} parents=${receipt.parent_rows.length} mutating=${receipt.mutating_parents.length} workflow=${receipt.workflow_id}\nsidecars in ${workDir}\n`
    )
  } catch (error) {
    raw.error = error instanceof Error ? error.message : String(error)
    writeJson(rawPath, raw)
    writeFileSync(
      join(workDir, `${caseId}.refused.jsonl`),
      `${JSON.stringify({ at: new Date().toISOString(), attempt, refused: raw.error })}\n`,
      { flag: 'a' }
    )
    throw error
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    const refused = error instanceof RecordRefusal
    console.error(
      `record: ${refused ? 'REFUSED' : 'FAILED'}: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
  })
}
