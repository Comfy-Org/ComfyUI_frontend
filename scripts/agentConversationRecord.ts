#!/usr/bin/env tsx

import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { z } from 'zod'

import {
  RecordRefusal,
  assembleCapture,
  parseOrRefuse,
  refuse,
  turnLabel,
  zAck,
  zJsonObject,
  zRowsDump,
  zSeedFixture
} from './agentConversationAssemble'
import type {
  NormalizedRows,
  RawCapture,
  RecordedFrame,
  RecordedTurn,
  TurnAck,
  TurnIds
} from './agentConversationAssemble'
import { exportAgentConversation } from './agentConversationCapture'

const USAGE =
  'usage: pnpm exec tsx scripts/agentConversationRecord.ts <caseId> <seedFixture.json> --prompt "<turn 1>" [--prompt "<turn 2>" ...] --out <fixture.json> [--work <dir>] [--cancel-turn <k> --cancel-after-ms <n>]'

const zEnv = z.object({
  AGENT_CLOUD_SHA: z.string().regex(/^[0-9a-f]{7,40}$/),
  AGENT_MODEL: z.string().trim().min(1),
  AGENT_M2M_SECRET_FILE: z.string().min(1),
  AGENT_WORKSPACE_ID: z.string().min(1),
  AGENT_USER_ID: z.string().min(1),
  AGENT_FULLSTACK_URL: z.string().default('http://127.0.0.1:8086'),
  AGENT_REDIS_EXEC: z.string().default('redis-cli'),
  AGENT_PG_EXEC: z.string().default('psql -U postgres -d postgres -At -c'),
  AGENT_TURN_TIMEOUT: z.coerce.number().positive().default(180_000),
  AGENT_ATTEMPT: z.string().default('')
})

const zSeedAck = zAck.extend({ workflow_id: z.string().min(1) })

// The socket carries frames without a data object; the replay union does not.
const zSocketFrame = z
  .object({
    type: z.string(),
    data: zJsonObject.optional().catch(undefined)
  })
  .transform((frame) => ({ type: frame.type, data: frame.data ?? {} }))

// The exporter's candidate set: data.ops when it is a list, else data.op.
const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const sha256 = (bytes: Buffer | string): string =>
  createHash('sha256').update(bytes).digest('hex')

const sha256OfFile = (path: string): string => sha256(readFileSync(path))

const writeJson = (path: string, value: unknown): void =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export function redactRecorderError(
  error: unknown,
  sensitiveValues: string[]
): string {
  return sensitiveValues
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .reduce(
      (message, sensitive) => message.replaceAll(sensitive, '[REDACTED]'),
      errorText(error)
    )
}

export function writeRefusalArtifacts(
  raw: RawCapture,
  rawPath: string,
  refusalPath: string,
  error: unknown,
  sensitiveValues: string[]
): string {
  const message = redactRecorderError(error, sensitiveValues)
  raw.error = message
  writeJson(rawPath, raw)
  writeFileSync(
    refusalPath,
    `${JSON.stringify({ at: new Date().toISOString(), attempt: raw.attempt, refused: message })}\n`,
    { flag: 'a' }
  )
  return message
}

export function readRows(
  exec: string[],
  path: string,
  ids: TurnIds & { workflowId: string }
): NormalizedRows {
  const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`
  const sql = `select json_build_object('source', 'postgres', 'parents', coalesce((select json_agg(row_to_json(r) order by r.started_at, r.id) from (select parent.id, parent.tool_call_id, parent.tool_name, parent.status, parent.result, parent.started_at, parent.workflow_id, coalesce(json_agg(json_build_object('op_id', child.op_id, 'status', child.status, 'op_index', child.op_index) order by child.op_index) filter (where child.id is not null), '[]'::json) as children from agent_tool_calls as parent left join agent_tool_calls as child on child.parent_call_id = parent.id where parent.thread_id = ${quote(ids.threadId)} and parent.message_id = ${quote(ids.messageId)} and parent.parent_call_id is null group by parent.id) r), '[]'::json), 'draft', (select content from workflow_drafts where workflow_id = ${quote(ids.workflowId)} limit 1))`
  let output: string
  try {
    output = execFileSync(exec[0], [...exec.slice(1), sql], {
      encoding: 'utf8'
    }).trim()
  } catch {
    refuse('Postgres command failed; subprocess details suppressed')
  }
  const dump: unknown = JSON.parse(output)
  writeJson(path, dump)
  const { parents, draft } = parseOrRefuse(zRowsDump, dump, 'rows dump')
  return {
    parents,
    draft,
    retrieval: { kind: 'postgres-json', sql },
    path,
    sha256: sha256OfFile(path)
  }
}

export function openStream(
  raw: RawCapture,
  redisExec: string[],
  onFrame: (frame: RecordedFrame) => void
): () => void {
  const push = (payload: string): void => {
    const frame = zSocketFrame.safeParse(safeJson(payload))
    onFrame(frame.success ? frame.data : { type: '__raw__', data: { payload } })
  }

  const child = spawn(
    redisExec[0],
    [...redisExec.slice(1), 'SUBSCRIBE', raw.channel],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )
  child.stdout.setEncoding('utf8')
  child.stderr.resume()
  child.on('error', () => {
    raw.error ??= 'Redis command failed to start; subprocess details suppressed'
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
    prompts: string[]
    cancel?: { turn: number; afterMs: number }
  }
): Promise<void> {
  const stop = openStream(raw, options.redisExec, (frame) =>
    raw.frames.push({ ...frame, at_ms: Date.now() })
  )

  const postTurn = async (thread: string, turn: unknown): Promise<TurnAck> => {
    const response = await fetch(
      `${raw.base}/agent/threads/${thread}/messages`,
      {
        method: 'POST',
        headers: options.headers,
        body: JSON.stringify(turn),
        signal: AbortSignal.timeout(30_000)
      }
    )
    const payload = await response.text()
    const body = zJsonObject.safeParse(safeJson(payload))
    if (response.status === 202 && !body.success)
      refuse(`202 with a non-JSON body: ${payload.slice(0, 200)}`)
    return { status: response.status, body: body.data ?? null }
  }

  // The panel's own stop button posts this and expects a 202.
  const postCancel = async (
    thread: string,
    messageId: string
  ): Promise<TurnAck> => {
    const response = await fetch(
      `${raw.base}/agent/threads/${thread}/messages/${messageId}/cancel`,
      {
        method: 'POST',
        headers: options.headers,
        body: '{}',
        signal: AbortSignal.timeout(30_000)
      }
    )
    const payload = await response.text()
    return {
      status: response.status,
      body: zJsonObject.safeParse(safeJson(payload)).data ?? null
    }
  }

  const done = (messageId: string): boolean =>
    raw.frames.some(
      (frame) =>
        frame.type === 'agent_message_done' &&
        frame.data.message_id === messageId
    )

  const waitDone = async (messageId: string, label: string): Promise<void> => {
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
    const seedTurn = await postTurn('new', {
      content:
        'Hello. Please do nothing to the workflow yet; just acknowledge.',
      draft: { content: options.seed }
    })
    raw.seed_turn = seedTurn
    const seedAck = zSeedAck.safeParse(seedTurn.body)
    if (seedTurn.status !== 202 || !seedAck.success)
      refuse(`seed turn not accepted: ${JSON.stringify(seedTurn)}`)
    raw.seed_workflow_id = seedAck.data.workflow_id
    await waitDone(seedAck.data.message_id, 'seed turn')

    // Turn 1 opens on a fresh workflow so switch_tab publishes
    // agent_active_tab; the rest continue that thread the way the panel does.
    let thread = 'new'
    let opening: string | null = null
    for (const [index, prompt] of options.prompts.entries()) {
      const posted = await postTurn(thread, {
        content: prompt,
        open_tabs: [
          { workflow_id: seedAck.data.workflow_id, name: raw.seed_name }
        ]
      })
      const turn: RecordedTurn = {
        prompt,
        accepted: posted,
        saw_done: false
      }
      raw.turns.push(turn)
      const ack = zAck.safeParse(posted.body)
      if (posted.status !== 202 || !ack.success)
        refuse(`${turnLabel(index)} not accepted: ${JSON.stringify(posted)}`)
      thread = ack.data.thread_id
      opening ??= ack.data.message_id
      if (options.cancel?.turn === index + 1) {
        await sleep(options.cancel.afterMs)
        turn.cancel_sent_at_ms = Date.now()
        turn.cancel_ack = await postCancel(thread, ack.data.message_id)
        if (turn.cancel_ack.status !== 202)
          refuse(
            `${turnLabel(index)} cancel not accepted: ${JSON.stringify(turn.cancel_ack)}`
          )
      }
      await waitDone(ack.data.message_id, turnLabel(index))
      turn.saw_done = true
    }

    if (
      !raw.frames.some(
        (frame) =>
          frame.type === 'agent_active_tab' &&
          frame.data.message_id === opening &&
          frame.data.workflow_id === seedAck.data.workflow_id
      )
    )
      refuse(
        `no agent_active_tab for ${seedAck.data.workflow_id}: the agent never switched tabs`
      )
  } finally {
    stop()
  }
}

async function main(argv: string[]): Promise<void> {
  const positional: string[] = []
  const flags: Record<string, string> = {}
  const prompts: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--prompt') prompts.push(argv[(index += 1)] ?? '')
    else if (
      arg === '--out' ||
      arg === '--work' ||
      arg === '--cancel-turn' ||
      arg === '--cancel-after-ms'
    )
      flags[arg] = argv[(index += 1)] ?? ''
    else positional.push(arg)
  }
  const [caseId, seedPath] = positional
  const outPath = flags['--out']
  if (!caseId || !seedPath || !outPath || prompts.length === 0)
    throw new Error(USAGE)
  if (prompts.some((turn) => !turn.trim())) throw new Error(USAGE)
  const cancel =
    flags['--cancel-turn'] === undefined
      ? undefined
      : {
          turn: Number(flags['--cancel-turn']),
          afterMs: Number(flags['--cancel-after-ms'] ?? '5000')
        }
  if (
    cancel &&
    (!Number.isInteger(cancel.turn) ||
      cancel.turn < 1 ||
      cancel.turn > prompts.length ||
      !Number.isFinite(cancel.afterMs) ||
      cancel.afterMs < 0)
  )
    throw new Error(USAGE)

  const env = parseOrRefuse(
    zEnv,
    {
      ...process.env,
      AGENT_WORKSPACE_ID: process.env.AGENT_WORKSPACE_ID,
      AGENT_USER_ID: process.env.AGENT_USER_ID
    },
    'environment'
  )
  const attempt = (
    env.AGENT_ATTEMPT.trim() || new Date().toISOString().replace(/[:.]/g, '-')
  ).replace(/[^A-Za-z0-9_-]/g, '-')

  const seed = parseOrRefuse(
    zSeedFixture,
    JSON.parse(readFileSync(seedPath, 'utf8')),
    `seed fixture ${seedPath}`
  )
  // conversations/ is scanned for replay cases, so sidecars go one level down.
  const workDir = flags['--work'] || join(dirname(outPath), 'recordings')
  mkdirSync(workDir, { recursive: true })
  mkdirSync(dirname(resolve(outPath)), { recursive: true })
  const sidecar = (suffix: string): string =>
    join(workDir, `${caseId}.${attempt}.${suffix}`)
  const rawPath = sidecar('raw.json')
  const postgresExec = env.AGENT_PG_EXEC.split(' ')
  const redisExec = env.AGENT_REDIS_EXEC.split(' ')
  const m2mSecret = readFileSync(env.AGENT_M2M_SECRET_FILE, 'utf8').trim()

  const raw: RawCapture = {
    case_id: caseId,
    attempt,
    base: env.AGENT_FULLSTACK_URL.replace(/\/$/, ''),
    // The note carries this shape; the concrete channel stays in the receipt.
    frame_source: 'redis SUBSCRIBE channel:ws:<workspace>:u:<user>',
    channel: `channel:ws:${env.AGENT_WORKSPACE_ID}:u:${env.AGENT_USER_ID}`,
    seed_sha256: sha256OfFile(seedPath),
    seed_name: seed.workflow.name,
    seed_node_ids: seed.workflow.seed.nodes.map((node) => node.id),
    saw_stream: false,
    stream_closed: false,
    seed_turn: null,
    seed_workflow_id: null,
    turns: [],
    timed_out: false,
    frames: [],
    rows_artifacts: [],
    retrieval: null,
    error: null
  }

  try {
    await recordTurns(raw, {
      headers: {
        'content-type': 'application/json',
        'X-Comfy-M2M-Secret': m2mSecret,
        'X-Comfy-Workspace': env.AGENT_WORKSPACE_ID,
        'X-Comfy-User': env.AGENT_USER_ID
      },
      redisExec,
      timeoutMs: env.AGENT_TURN_TIMEOUT,
      seed: seed.workflow.seed,
      prompts,
      cancel
    })

    // One row set per turn; the last one also carries the final draft.
    const rows = raw.turns.map((turn, index) => {
      const ids = zAck.parse(turn.accepted?.body)
      return readRows(postgresExec, sidecar(`rows.${index + 1}.json`), {
        threadId: ids.thread_id,
        messageId: ids.message_id,
        workflowId: String(raw.seed_workflow_id)
      })
    })
    raw.rows_artifacts = rows.map((set) => set.path)
    raw.retrieval = rows[0].retrieval
    writeJson(rawPath, raw)

    const { capture, receipt } = assembleCapture({
      raw,
      rows,
      seed: { json: seed, path: seedPath, sha256: raw.seed_sha256 },
      provenance: {
        cloudSha: env.AGENT_CLOUD_SHA,
        model: env.AGENT_MODEL,
        exportedAt: new Date().toISOString()
      },
      rawSha256: sha256OfFile(rawPath),
      rawPath
    })
    writeJson(sidecar('capture.json'), capture)
    writeJson(outPath, exportAgentConversation(capture))
    writeJson(sidecar('receipt.json'), receipt)
    const perTurn = receipt.turns
      .map(
        (turn, index) =>
          `t${index + 1}[frames=${turn.frames_kept} parents=${turn.parents} mutating=${turn.mutating_parents}]`
      )
      .join(' ')
    process.stdout.write(
      `recorded ${outPath} sha256=${sha256OfFile(outPath)} attempt=${attempt} turns=${receipt.turns.length} ${perTurn} dropped=${JSON.stringify(receipt.frames_dropped)} workflow=${receipt.workflow_id}\nsidecars in ${workDir}\n`
    )
  } catch (error) {
    const message = writeRefusalArtifacts(
      raw,
      rawPath,
      join(workDir, `${caseId}.refused.jsonl`),
      error,
      [m2mSecret]
    )
    throw new RecordRefusal(message)
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    const refused = error instanceof RecordRefusal
    process.stderr.write(
      `record: ${refused ? 'REFUSED' : 'FAILED'}: ${errorText(error)}\n`
    )
    process.exitCode = 1
  })
}
