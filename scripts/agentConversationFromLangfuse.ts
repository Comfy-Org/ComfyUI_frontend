#!/usr/bin/env tsx

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { z } from 'zod'

import {
  RecordRefusal,
  assembleConversation,
  parseOrRefuse,
  refuse,
  zAck,
  zSeedFixture
} from './agentConversationAssemble'
import type {
  RawCapture,
  RecordedFrame,
  RecordedTurn,
  SeedFixture
} from './agentConversationAssemble'
import { readRows } from './agentConversationRecord'

const USAGE =
  'usage: pnpm exec tsx scripts/agentConversationFromLangfuse.ts <caseId> <seedFixture.json> (--trace <traceId> | --session <sessionId>) --workflow <cloudWorkflowId> --out <fixture.json> [--work <dir>] [--env-file <path>] [--prompt "<turn 1>" ...]'

const DEFAULT_ENV_FILE = join(
  process.env.HOME ?? '',
  '.config/comfy-agent/langfuse.env'
)

export const zLangfuseEnv = z.object({
  LANGFUSE_HOST: z.string().url(),
  LANGFUSE_PUBLIC_KEY: z.string().min(1),
  LANGFUSE_SECRET_KEY: z.string().min(1)
})
export type LangfuseEnv = z.infer<typeof zLangfuseEnv>

const zEnv = z.object({
  AGENT_CLOUD_SHA: z.string().regex(/^[0-9a-f]{7,40}$/),
  AGENT_PG_EXEC: z.string().default('psql -U postgres -d postgres -At -c'),
  AGENT_ATTEMPT: z.string().default('')
})

export const zObservation = z
  .object({
    id: z.string(),
    traceId: z.string(),
    type: z.string().nullish(),
    name: z.string().nullish(),
    startTime: z.string(),
    endTime: z.string().nullish(),
    input: z.unknown(),
    output: z.unknown(),
    metadata: z.unknown(),
    parentObservationId: z.string().nullish()
  })
  .passthrough()
export type Observation = z.infer<typeof zObservation>

const zPage = z.object({
  data: z.array(zObservation),
  meta: z.object({ totalPages: z.number().optional() }).passthrough().optional()
})

const zTracePage = z.object({
  data: z.array(z.object({ id: z.string() }).passthrough()),
  meta: z.object({ totalPages: z.number().optional() }).passthrough().optional()
})

// The values are secrets: never logged, never written into an artifact.
export function readEnvFile(path: string): LangfuseEnv {
  const pairs = readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => line.replace(/^export\s+/, ''))
    .flatMap((line) => {
      const eq = line.indexOf('=')
      return eq === -1
        ? []
        : [[line.slice(0, eq).trim(), line.slice(eq + 1).trim()] as const]
    })
  return parseOrRefuse(
    zLangfuseEnv,
    Object.fromEntries(pairs),
    `Langfuse env file ${path}`
  )
}

// Langfuse keeps unmapped OTel attributes under metadata.attributes; flattened metadata is the fallback.
export function attributeOf(
  observation: Observation,
  key: string
): string | undefined {
  const metadata = z
    .record(z.string(), z.unknown())
    .safeParse(observation.metadata)
  if (!metadata.success) return undefined
  const nested = z
    .record(z.string(), z.unknown())
    .safeParse(metadata.data.attributes)
  const value = nested.success ? nested.data[key] : metadata.data[key]
  if (typeof value === 'string') return value
  if (typeof value === 'boolean' || typeof value === 'number')
    return String(value)
  return undefined
}

function textOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  return value === undefined || value === null
    ? undefined
    : JSON.stringify(value)
}

export interface CaptureOptions {
  caseId: string
  attempt: string
  host: string
  threadId: string
  workflowId: string
  seed: SeedFixture
  seedSha256: string
  prompts?: string[]
}

interface TurnSpans {
  root: Observation
  tools: Observation[]
}

const atMs = (iso: string): number => Date.parse(iso)

// Children inherit no attributes, so a tool span finds its turn through parentObservationId.
function groupTurns(
  observations: Observation[],
  threadId: string
): TurnSpans[] {
  const byId = new Map(
    observations.map((observation) => [observation.id, observation])
  )
  const byTurn = new Map<string, TurnSpans>()
  const turnOf = new Map<string, TurnSpans>()
  // The launch span carries the ids but no text; invoke_agent marks the turn span (cloud loop/host.go:265).
  const isTurnSpan = (observation: Observation): boolean =>
    attributeOf(observation, 'gen_ai.operation.name') === 'invoke_agent'
  for (const observation of observations) {
    if (attributeOf(observation, 'comfy.thread_id') !== threadId) continue
    const turnId = attributeOf(observation, 'comfy.turn_id')
    if (turnId === undefined) continue
    const existing = byTurn.get(turnId)
    const replaces =
      existing === undefined ||
      (isTurnSpan(observation) &&
        (!isTurnSpan(existing.root) ||
          atMs(observation.startTime) < atMs(existing.root.startTime)))
    const turn = replaces
      ? { root: observation, tools: existing?.tools ?? [] }
      : existing
    byTurn.set(turnId, turn)
    turnOf.set(observation.id, turn)
  }
  for (const [turnId, turn] of byTurn)
    if (!isTurnSpan(turn.root))
      refuse(
        `turn ${turnId} has no span marked gen_ai.operation.name invoke_agent; only its launch or analytics spans were exported`
      )
  for (const observation of observations) {
    if (attributeOf(observation, 'gen_ai.tool.call.id') === undefined) continue
    let cursor = observation.parentObservationId ?? null
    let turn: TurnSpans | undefined
    for (let hops = 0; cursor !== null && hops < 32; hops += 1) {
      turn = turnOf.get(cursor)
      if (turn !== undefined) break
      cursor = byId.get(cursor)?.parentObservationId ?? null
    }
    if (turn === undefined)
      refuse(
        `tool span ${observation.id} (${attributeOf(observation, 'gen_ai.tool.name') ?? observation.name}) is not under any turn of thread ${threadId}`
      )
    turn.tools.push(observation)
  }
  return [...byTurn.values()].sort(
    (a, b) => atMs(a.root.startTime) - atMs(b.root.startTime)
  )
}

// Each tool span becomes its running and terminal frames; the turn's output becomes the text.
function turnFrames(
  turn: TurnSpans,
  threadId: string,
  turnId: string
): RecordedFrame[] {
  const ids = { thread_id: threadId, message_id: turnId }
  const frames: RecordedFrame[] = []
  for (const tool of turn.tools) {
    const toolCallId = attributeOf(tool, 'gen_ai.tool.call.id')!
    const toolName = attributeOf(tool, 'gen_ai.tool.name') ?? tool.name ?? ''
    const ok = attributeOf(tool, 'comfy.tool.ok')
    frames.push({
      type: 'agent_tool_call',
      data: {
        ...ids,
        tool_call_id: toolCallId,
        tool_name: toolName,
        status: 'running'
      },
      at_ms: atMs(tool.startTime)
    })
    frames.push({
      type: 'agent_tool_call',
      data: {
        ...ids,
        tool_call_id: toolCallId,
        tool_name: toolName,
        status: ok === 'false' ? 'error' : 'success'
      },
      at_ms: atMs(tool.endTime ?? tool.startTime)
    })
  }
  const end = atMs(turn.root.endTime ?? turn.root.startTime)
  const text = textOf(turn.root.output)
  if (text !== undefined)
    frames.push({
      type: 'agent_message_delta',
      data: { ...ids, delta: text },
      at_ms: end
    })
  frames.push({ type: 'agent_message_done', data: { ...ids }, at_ms: end })
  return frames.sort((a, b) => (a.at_ms ?? 0) - (b.at_ms ?? 0))
}

export function captureFromObservations(
  observations: Observation[],
  options: CaptureOptions
): RawCapture {
  const turns = groupTurns(observations, options.threadId)
  if (turns.length === 0)
    refuse(
      `no observation carries comfy.thread_id ${options.threadId} with a comfy.turn_id`
    )
  const recordedTurns: RecordedTurn[] = []
  const frames: RecordedFrame[] = []
  for (const [index, turn] of turns.entries()) {
    const turnId = attributeOf(turn.root, 'comfy.turn_id')!
    const prompt = options.prompts?.[index] ?? textOf(turn.root.input)
    if (prompt === undefined)
      refuse(
        `turn ${index + 1} (${turnId}) has no recorded input; content capture was off, pass --prompt for each turn`
      )
    if (textOf(turn.root.output) === undefined)
      refuse(
        `turn ${index + 1} (${turnId}) has no recorded output; content capture was off on the agent, so the reply text cannot be replayed`
      )
    recordedTurns.push({
      prompt,
      accepted: {
        status: 202,
        body: { thread_id: options.threadId, message_id: turnId }
      },
      saw_done: true
    })
    frames.push(...turnFrames(turn, options.threadId, turnId))
  }
  return {
    case_id: options.caseId,
    attempt: options.attempt,
    base: options.host,
    frame_source: `langfuse observations, ${observations.length} spans`,
    channel: `langfuse:${observations[0]?.traceId ?? ''}`,
    seed_sha256: options.seedSha256,
    seed_name: options.seed.workflow.name,
    seed_node_ids: options.seed.workflow.seed.nodes.map((node) => node.id),
    saw_stream: true,
    stream_closed: true,
    seed_turn: null,
    seed_workflow_id: options.workflowId,
    turns: recordedTurns,
    timed_out: false,
    frames,
    error: null
  }
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>

async function pages<T>(
  env: LangfuseEnv,
  path: string,
  query: Record<string, string>,
  schema: z.ZodType<{ data: T[]; meta?: { totalPages?: number } }>,
  fetchImpl: Fetch
): Promise<T[]> {
  const auth = Buffer.from(
    `${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`
  ).toString('base64')
  const items: T[] = []
  for (let page = 1; ; page += 1) {
    const url = new URL(path, env.LANGFUSE_HOST)
    for (const [key, value] of Object.entries({
      ...query,
      page: String(page),
      limit: '100'
    }))
      url.searchParams.set(key, value)
    const response = await fetchImpl(url.toString(), {
      headers: { authorization: `Basic ${auth}` }
    })
    if (!response.ok)
      refuse(`Langfuse ${path} returned ${response.status} on page ${page}`)
    const parsed = parseOrRefuse(
      schema,
      await response.json(),
      `Langfuse ${path} page ${page}`
    )
    items.push(...parsed.data)
    const totalPages = parsed.meta?.totalPages
    if (
      parsed.data.length === 0 ||
      (totalPages !== undefined ? page >= totalPages : parsed.data.length < 100)
    )
      return items
  }
}

export async function fetchObservations(
  env: LangfuseEnv,
  selector: { traceId?: string; sessionId?: string },
  fetchImpl: Fetch = (url, init) => fetch(url, init)
): Promise<Observation[]> {
  const traceIds =
    selector.traceId !== undefined
      ? [selector.traceId]
      : (
          await pages(
            env,
            '/api/public/traces',
            { sessionId: selector.sessionId ?? '' },
            zTracePage,
            fetchImpl
          )
        ).map((trace) => trace.id)
  const observations: Observation[] = []
  for (const traceId of traceIds)
    observations.push(
      ...(await pages(
        env,
        '/api/public/observations',
        { traceId },
        zPage,
        fetchImpl
      ))
    )
  return observations
}

const sha256 = (bytes: Buffer | string): string =>
  createHash('sha256').update(bytes).digest('hex')
const sha256OfFile = (path: string): string => sha256(readFileSync(path))
const writeJson = (path: string, value: unknown): void =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

function parseArgs(argv: string[]) {
  const positional: string[] = []
  const flags: Record<string, string> = {}
  const prompts: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--prompt') prompts.push(argv[(index += 1)] ?? '')
    else if (arg.startsWith('--')) flags[arg] = argv[(index += 1)] ?? ''
    else positional.push(arg)
  }
  return { positional, flags, prompts }
}

export async function main(argv: string[]): Promise<void> {
  const { positional, flags, prompts } = parseArgs(argv)
  const [caseId, seedPath] = positional
  const traceId = flags['--trace']
  const sessionId = flags['--session']
  const workflowId = flags['--workflow']
  const outPath = flags['--out']
  if (
    !caseId ||
    !seedPath ||
    !workflowId ||
    !outPath ||
    (traceId === undefined) === (sessionId === undefined)
  )
    refuse(USAGE)

  const langfuse = readEnvFile(flags['--env-file'] ?? DEFAULT_ENV_FILE)
  const env = parseOrRefuse(zEnv, process.env, 'environment')
  const attempt = (
    env.AGENT_ATTEMPT.trim() || new Date().toISOString().replace(/[:.]/g, '-')
  ).replace(/[^A-Za-z0-9_-]/g, '-')
  const seed = parseOrRefuse(
    zSeedFixture,
    JSON.parse(readFileSync(seedPath, 'utf8')),
    `seed fixture ${seedPath}`
  )
  const workDir = flags['--work'] || join(dirname(outPath), 'recordings')
  mkdirSync(workDir, { recursive: true })
  mkdirSync(dirname(resolve(outPath)), { recursive: true })
  const sidecar = (suffix: string): string =>
    join(workDir, `${caseId}.${attempt}.${suffix}`)

  const observations = await fetchObservations(langfuse, { traceId, sessionId })
  const threadIds = new Set(
    observations.flatMap((observation) => {
      const id = attributeOf(observation, 'comfy.thread_id')
      return id === undefined ? [] : [id]
    })
  )
  if (threadIds.size !== 1)
    refuse(
      `expected exactly one comfy.thread_id across the observations, found ${[...threadIds].join(', ') || 'none'}`
    )
  const [threadId] = threadIds
  const raw = captureFromObservations(observations, {
    caseId,
    attempt,
    host: langfuse.LANGFUSE_HOST,
    threadId,
    workflowId,
    seed,
    seedSha256: sha256OfFile(seedPath),
    prompts: prompts.length > 0 ? prompts : undefined
  })
  const rawPath = sidecar('raw.json')
  writeJson(rawPath, raw)

  try {
    const rows = raw.turns.map((turn, index) =>
      readRows(
        env.AGENT_PG_EXEC.split(' '),
        sidecar(`rows.${index + 1}.json`),
        {
          threadId,
          messageId: zAck.parse(turn.accepted?.body).message_id,
          workflowId
        }
      )
    )
    const model =
      observations
        .map((observation) => attributeOf(observation, 'gen_ai.response.model'))
        .find((value) => value !== undefined) ?? 'unknown'
    const { conversation, receipt } = assembleConversation({
      raw,
      rows,
      seed: { json: seed, path: seedPath, sha256: raw.seed_sha256 },
      provenance: {
        cloudSha: env.AGENT_CLOUD_SHA,
        model,
        exportedAt: new Date().toISOString()
      },
      rawSha256: sha256OfFile(rawPath),
      rawPath
    })
    writeJson(outPath, conversation)
    writeJson(sidecar('receipt.json'), receipt)
    process.stdout.write(
      `imported ${outPath} sha256=${sha256OfFile(outPath)} attempt=${attempt} turns=${receipt.turns.length} dropped=${JSON.stringify(receipt.frames_dropped)}\nsidecars in ${workDir}\n`
    )
  } catch (error) {
    writeFileSync(
      join(workDir, `${caseId}.refused.jsonl`),
      `${JSON.stringify({ at: new Date().toISOString(), attempt, refused: error instanceof Error ? error.message : String(error) })}\n`,
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
    process.stderr.write(
      `import: ${refused ? 'REFUSED' : 'FAILED'}: ${error instanceof Error ? error.message : String(error)}\n`
    )
    process.exitCode = 1
  })
}
