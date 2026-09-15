import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { RecordRefusal } from './agentConversationAssemble'
import type { Observation } from './agentConversationFromLangfuse'
import {
  LangfuseRequestError,
  attributeOf,
  captureFromObservations,
  fetchObservations,
  main,
  readEnvFile
} from './agentConversationFromLangfuse'
import {
  assertOpsApply,
  zAgentConversation
} from '../browser_tests/fixtures/data/agent/agentConversation'
import { HostDoc } from '../browser_tests/fixtures/agentConversationHostDoc'

const THREAD = 'thread-1'
const WORKFLOW = '6f1c2c1e-3b1c-4c88-9d9c-0d6e9b8e1a01'

const span = (
  id: string,
  attributes: Record<string, unknown>,
  extra: Partial<Observation> = {}
): Observation => ({
  id,
  traceId: 'trace-1',
  type: 'span',
  name: id,
  startTime: '2026-09-04T10:00:00.000Z',
  endTime: '2026-09-04T10:00:01.000Z',
  input: undefined,
  output: undefined,
  metadata: { attributes },
  parentObservationId: null,
  ...extra
})

// Only the turn span carries the thread and turn ids; children do not inherit them.
const turnRoot = (turnId: string, start: string, end: string): Observation =>
  span(
    `root-${turnId}`,
    {
      'comfy.thread_id': THREAD,
      'comfy.turn_id': turnId,
      'gen_ai.operation.name': 'invoke_agent'
    },
    {
      name: 'agent.turn',
      startTime: start,
      endTime: end,
      input: 'Add a sampler',
      output: 'Added a KSampler.',
      parentObservationId: `launch-${turnId}`
    }
  )

// The engine's launch span sits above the turn, carries the ids, and has no input or output.
const launchSpan = (turnId: string, start: string): Observation =>
  span(
    `launch-${turnId}`,
    { 'comfy.thread_id': THREAD, 'comfy.turn_id': turnId },
    { name: 'agent.launch', startTime: start, endTime: null }
  )

const roundSpan = (turnId: string): Observation =>
  span(
    `round-${turnId}`,
    { 'gen_ai.operation.name': 'chat' },
    { name: 'agent.model_round', parentObservationId: `root-${turnId}` }
  )

const toolSpan = (
  turnId: string,
  callId: string,
  ok: boolean,
  start: string,
  end: string
): Observation =>
  span(
    `tool-${callId}`,
    {
      'gen_ai.tool.call.id': callId,
      'gen_ai.tool.name': 'apply_ops',
      'comfy.tool.ok': ok
    },
    {
      name: 'agent.tool apply_ops',
      startTime: start,
      endTime: end,
      parentObservationId: `round-${turnId}`
    }
  )

const options = {
  caseId: 'agent-lf-example',
  attempt: 'a1',
  host: 'https://langfuse.example',
  threadId: THREAD,
  workflowId: WORKFLOW,
  seed: {
    workflow: {
      id: WORKFLOW,
      name: 'Text to image',
      catalog: { types: {} },
      seed: { nodes: [{ id: 3, type: 'CheckpointLoaderSimple' }], links: [] }
    }
  },
  seedSha256: 'a'.repeat(64)
}

describe('captureFromObservations', () => {
  it('attaches tool spans to their turn through the parent chain', () => {
    const raw = captureFromObservations(
      [
        launchSpan('message-1', '2026-09-04T09:59:59.000Z'),
        toolSpan(
          'message-1',
          'tool-1',
          true,
          '2026-09-04T10:00:00.200Z',
          '2026-09-04T10:00:00.700Z'
        ),
        roundSpan('message-1'),
        turnRoot(
          'message-1',
          '2026-09-04T10:00:00.000Z',
          '2026-09-04T10:00:01.000Z'
        )
      ],
      options
    )
    expect(raw.turns).toEqual([
      {
        prompt: 'Add a sampler',
        accepted: {
          status: 202,
          body: { thread_id: THREAD, message_id: 'message-1' }
        }
      }
    ])
    expect(
      raw.frames.map((frame) => [frame.type, frame.data.status, frame.at_ms])
    ).toEqual([
      ['agent_active_tab', undefined, Date.parse('2026-09-04T10:00:00.000Z')],
      ['agent_tool_call', 'running', Date.parse('2026-09-04T10:00:00.200Z')],
      ['agent_tool_call', 'success', Date.parse('2026-09-04T10:00:00.700Z')],
      [
        'agent_message_delta',
        undefined,
        Date.parse('2026-09-04T10:00:01.000Z')
      ],
      ['agent_message_done', undefined, Date.parse('2026-09-04T10:00:01.000Z')]
    ])
    expect(raw.frames[1].data).toMatchObject({
      thread_id: THREAD,
      message_id: 'message-1',
      tool_call_id: 'tool-1',
      tool_name: 'apply_ops'
    })
    expect(raw.frames[3].data.delta).toBe('Added a KSampler.')
    expect(raw.seed_workflow_id).toBe(WORKFLOW)
    expect(raw.seed_node_ids).toEqual([3])
  })

  it('orders turns by start time and marks a failed tool as error', () => {
    const raw = captureFromObservations(
      [
        turnRoot(
          'message-2',
          '2026-09-04T10:01:00.000Z',
          '2026-09-04T10:01:02.000Z'
        ),
        roundSpan('message-2'),
        toolSpan(
          'message-2',
          'tool-2',
          false,
          '2026-09-04T10:01:00.500Z',
          '2026-09-04T10:01:01.000Z'
        ),
        turnRoot(
          'message-1',
          '2026-09-04T10:00:00.000Z',
          '2026-09-04T10:00:01.000Z'
        )
      ],
      options
    )
    expect(raw.turns.map((turn) => turn.accepted?.body)).toEqual([
      { thread_id: THREAD, message_id: 'message-1' },
      { thread_id: THREAD, message_id: 'message-2' }
    ])
    const terminal = raw.frames.find(
      (frame) =>
        frame.data.tool_call_id === 'tool-2' && frame.data.status !== 'running'
    )
    expect(terminal?.data.status).toBe('error')
    expect(terminal?.data.message_id).toBe('message-2')
  })

  it('opens the thread with the tab frame the assembler binds the replay through', () => {
    const raw = captureFromObservations(
      [
        launchSpan('turn-1', '2026-09-04T10:00:00.000Z'),
        turnRoot(
          'turn-1',
          '2026-09-04T10:00:00.000Z',
          '2026-09-04T10:00:05.000Z'
        )
      ],
      options
    )
    expect(raw.frames[0]).toEqual({
      type: 'agent_active_tab',
      data: {
        thread_id: THREAD,
        message_id: 'turn-1',
        workflow_id: WORKFLOW,
        name: 'Text to image'
      },
      at_ms: Date.parse('2026-09-04T10:00:00.000Z')
    })
  })

  it('refuses a tool span that carries no terminal outcome', () => {
    const start = '2026-09-04T10:00:00.000Z'
    const end = '2026-09-04T10:00:05.000Z'
    const thread = (tool: Observation) => [
      launchSpan('turn-1', start),
      turnRoot('turn-1', start, end),
      roundSpan('turn-1'),
      tool
    ]
    const complete = toolSpan('turn-1', 'call-1', true, start, end)
    for (const partial of [
      { ...complete, endTime: null },
      {
        ...complete,
        metadata: {
          attributes: {
            'gen_ai.tool.call.id': 'call-1',
            'gen_ai.tool.name': 'apply_ops'
          }
        }
      },
      {
        ...complete,
        metadata: {
          attributes: {
            'gen_ai.tool.call.id': 'call-1',
            'gen_ai.tool.name': 'apply_ops',
            'comfy.tool.ok': 'maybe'
          }
        }
      }
    ])
      expect(() => captureFromObservations(thread(partial), options)).toThrow(
        'tool call call-1 (apply_ops) in turn turn-1 has no terminal outcome'
      )
    expect(
      captureFromObservations(thread(complete), options).frames.filter(
        (frame) => frame.type === 'agent_tool_call'
      )
    ).toHaveLength(2)
  })

  it('refuses a turn exported without its invoke_agent span', () => {
    expect(() =>
      captureFromObservations(
        [launchSpan('message-1', '2026-09-04T09:59:59.000Z')],
        options
      )
    ).toThrow(
      'turn message-1 has no span marked gen_ai.operation.name invoke_agent'
    )
  })

  it('refuses a tool span that reaches no turn of the thread', () => {
    const orphan = toolSpan(
      'message-9',
      'tool-9',
      true,
      '2026-09-04T10:00:00.200Z',
      '2026-09-04T10:00:00.700Z'
    )
    expect(() =>
      captureFromObservations(
        [
          orphan,
          turnRoot(
            'message-1',
            '2026-09-04T10:00:00.000Z',
            '2026-09-04T10:00:01.000Z'
          )
        ],
        options
      )
    ).toThrow('tool span tool-tool-9 (apply_ops) is not under any turn')
  })

  it('takes the prompts from the command line when content capture was off', () => {
    const root = turnRoot(
      'message-1',
      '2026-09-04T10:00:00.000Z',
      '2026-09-04T10:00:01.000Z'
    )
    const raw = captureFromObservations([{ ...root, input: undefined }], {
      ...options,
      prompts: ['Add a sampler please']
    })
    expect(raw.turns[0].prompt).toBe('Add a sampler please')
    expect(() =>
      captureFromObservations([{ ...root, input: undefined }], options)
    ).toThrow('pass --prompt for each turn')
    expect(() =>
      captureFromObservations([{ ...root, output: undefined }], options)
    ).toThrow('no recorded output')
  })

  it('ignores turns of other threads and refuses when none match', () => {
    const foreign = span('x', {
      'comfy.thread_id': 'thread-2',
      'comfy.turn_id': 'message-9'
    })
    expect(() => captureFromObservations([foreign], options)).toThrow(
      'no observation carries comfy.thread_id thread-1'
    )
  })
})

describe('attributeOf', () => {
  it('reads nested OTel attributes and flattened metadata keys', () => {
    const nested = span('n', { 'comfy.turn_id': 'm-1', 'comfy.tool.ok': false })
    expect(attributeOf(nested, 'comfy.turn_id')).toBe('m-1')
    expect(attributeOf(nested, 'comfy.tool.ok')).toBe('false')
    const flat: Observation = {
      ...nested,
      metadata: { 'comfy.turn_id': 'm-2' }
    }
    expect(attributeOf(flat, 'comfy.turn_id')).toBe('m-2')
    expect(
      attributeOf({ ...nested, metadata: null }, 'comfy.turn_id')
    ).toBeUndefined()
  })
})

describe('readEnvFile', () => {
  it('parses KEY=VALUE lines, skipping comments and the export prefix', () => {
    const dir = mkdtempSync(join(tmpdir(), 'langfuse-env-'))
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }))
    const path = join(dir, 'langfuse.env')
    writeFileSync(
      path,
      '# comfy-agent langfuse\nexport LANGFUSE_HOST=https://langfuse.example\nLANGFUSE_PUBLIC_KEY=pk-test\nLANGFUSE_SECRET_KEY=sk-test\n'
    )
    expect(readEnvFile(path)).toEqual({
      LANGFUSE_HOST: 'https://langfuse.example',
      LANGFUSE_PUBLIC_KEY: 'pk-test',
      LANGFUSE_SECRET_KEY: 'sk-test'
    })
    writeFileSync(path, 'LANGFUSE_HOST=https://langfuse.example\n')
    expect(() => readEnvFile(path)).toThrow('LANGFUSE_PUBLIC_KEY')
    writeFileSync(
      path,
      'LANGFUSE_HOST=https://user:hunter2@langfuse.example\nLANGFUSE_PUBLIC_KEY=pk-test\nLANGFUSE_SECRET_KEY=sk-test\n'
    )
    const refusal = (() => {
      try {
        readEnvFile(path)
        return null
      } catch (error) {
        return error
      }
    })()
    expect(refusal).toBeInstanceOf(RecordRefusal)
    expect(refusal instanceof RecordRefusal && refusal.message).toBe(
      `Langfuse env file ${path}: LANGFUSE_HOST must not carry credentials`
    )
  })
})

describe('fetchObservations', () => {
  const env = {
    LANGFUSE_HOST: 'https://langfuse.example',
    LANGFUSE_PUBLIC_KEY: 'pk-test',
    LANGFUSE_SECRET_KEY: 'sk-test'
  }
  const page = (data: unknown[], totalPages: number) =>
    new Response(JSON.stringify({ data, meta: { totalPages } }), {
      status: 200
    })

  it('walks every page of a trace with basic auth', async () => {
    const calls: string[] = []
    const observations = await fetchObservations(
      env,
      { traceId: 'trace-1' },
      async (url, init) => {
        calls.push(url)
        expect(new Headers(init.headers).get('authorization')).toBe(
          `Basic ${Buffer.from('pk-test:sk-test').toString('base64')}`
        )
        const pageNumber = new URL(url).searchParams.get('page')
        return page([span(`o-${pageNumber}`, {})], 2)
      }
    )
    expect(observations.map((observation) => observation.id)).toEqual([
      'o-1',
      'o-2'
    ])
    expect(calls.map((url) => new URL(url).pathname)).toEqual([
      '/api/public/observations',
      '/api/public/observations'
    ])
    expect(new URL(calls[0]).searchParams.get('traceId')).toBe('trace-1')
  })

  it('resolves a session to its traces first', async () => {
    const paths: string[] = []
    const observations = await fetchObservations(
      env,
      { sessionId: 'session-1' },
      async (url) => {
        const parsed = new URL(url)
        paths.push(parsed.pathname)
        if (parsed.pathname === '/api/public/traces') {
          expect(parsed.searchParams.get('sessionId')).toBe('session-1')
          return page([{ id: 't-1' }, { id: 't-2' }], 1)
        }
        return page([span(`o-${parsed.searchParams.get('traceId')}`, {})], 1)
      }
    )
    expect(paths).toEqual([
      '/api/public/traces',
      '/api/public/observations',
      '/api/public/observations'
    ])
    expect(observations.map((observation) => observation.id)).toEqual([
      'o-t-1',
      'o-t-2'
    ])
  })

  it('reports a non-2xx page as a request failure, not a capture refusal', async () => {
    const fetchImpl = async () =>
      new Response('upstream detail that must not be echoed', {
        status: 503
      })
    const failure = await fetchObservations(
      env,
      { traceId: 'trace-1' },
      fetchImpl
    ).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(LangfuseRequestError)
    expect(failure).not.toBeInstanceOf(RecordRefusal)
    expect(failure instanceof LangfuseRequestError && failure.message).toBe(
      'Langfuse /api/public/observations returned 503 on page 1'
    )
  })
})

describe('main', () => {
  const { workflow } = zAgentConversation.parse(
    JSON.parse(
      readFileSync(
        'browser_tests/fixtures/data/agent/conversations/agent-rec-text-only-answer.json',
        'utf8'
      )
    )
  )
  const T0 = '2026-09-04T10:00:00.000Z'
  const T1 = '2026-09-04T10:00:01.000Z'
  const T2 = '2026-09-04T10:00:02.000Z'
  const T5 = '2026-09-04T10:00:05.000Z'

  const stage = (host = 'https://langfuse.example') => {
    const dir = mkdtempSync(join(tmpdir(), 'agent-langfuse-import-'))
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }))
    const seedPath = join(dir, 'seed.json')
    writeFileSync(seedPath, JSON.stringify({ workflow }))
    const rowsScript = join(dir, 'rows.cjs')
    writeFileSync(
      rowsScript,
      "process.stdout.write(JSON.stringify(require('./rows.json')))\n"
    )
    const envPath = join(dir, 'langfuse.env')
    writeFileSync(
      envPath,
      `LANGFUSE_HOST=${host}\nLANGFUSE_PUBLIC_KEY=pk-test\nLANGFUSE_SECRET_KEY=sk-test\n`
    )
    vi.stubEnv('AGENT_CLOUD_SHA', 'abc1234')
    vi.stubEnv('AGENT_ATTEMPT', 'a1')
    vi.stubEnv('AGENT_PG_EXEC', `${process.execPath}  ${rowsScript}`)
    const stdout = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    onTestFinished(() => {
      stdout.mockRestore()
      vi.unstubAllEnvs()
    })
    const outPath = join(dir, 'out', 'agent-lf-example.json')
    const workDir = join(dir, 'work')
    return {
      envPath,
      workDir,
      outPath,
      argv: [
        'agent-lf-example',
        seedPath,
        '--trace',
        'trace-1',
        '--workflow',
        workflow.id,
        '--out',
        outPath,
        '--work',
        workDir,
        '--env-file',
        envPath
      ],
      rows: (dump: { parents: unknown[]; draft: unknown }) =>
        writeFileSync(
          join(dir, 'rows.json'),
          JSON.stringify({ source: 'postgres', ...dump })
        ),
      page: (observations: Observation[]) => async (url: string) => {
        expect(new URL(url).pathname).toBe('/api/public/observations')
        return new Response(
          JSON.stringify({ data: observations, meta: { totalPages: 1 } }),
          { status: 200 }
        )
      },
      written: () =>
        zAgentConversation.parse(JSON.parse(readFileSync(outPath, 'utf8')))
    }
  }

  it('imports a text-only trace into a fixture the replay accepts', async () => {
    const s = stage()
    s.rows({
      parents: [],
      draft: { nodes: workflow.seed.nodes, links: workflow.seed.links }
    })
    await main(
      s.argv,
      s.page([launchSpan('turn-1', T0), turnRoot('turn-1', T0, T5)])
    )
    const conversation = s.written()
    expect(() => assertOpsApply(conversation)).not.toThrow()
    expect(conversation.workflow.id).toBe(workflow.id)
    expect(conversation.turns.map((turn) => turn.message_id)).toEqual([
      'turn-1'
    ])
    expect(conversation.turns[0].request).toEqual({ content: 'Add a sampler' })
    expect(
      conversation.turns[0].response.map((entry) =>
        entry.kind === 'event' ? entry.event.type : entry.kind
      )
    ).toEqual(['agent_active_tab', 'agent_message_delta', 'agent_message_done'])
    expect(readdirSync(s.workDir).sort()).toEqual([
      'agent-lf-example.a1.raw.json',
      'agent-lf-example.a1.receipt.json',
      'agent-lf-example.a1.rows.1.json'
    ])
    for (const file of [
      s.outPath,
      ...readdirSync(s.workDir).map((name) => join(s.workDir, name))
    ])
      expect(readFileSync(file, 'utf8')).not.toMatch(/pk-test|sk-test/)
  })

  it('imports a tool turn whose audit rows and draft agree with the op it applied', async () => {
    const s = stage()
    const op = {
      op: 'set_widget' as const,
      node_id: 3,
      widget: 'steps',
      value: 30,
      old: 20
    }
    const host = new HostDoc(workflow.id, workflow.seed, workflow.catalog)
    host.apply([op])
    s.rows({
      parents: [
        {
          id: 'parent-1',
          tool_call_id: 'call-1',
          tool_name: 'apply_ops',
          status: 'ok',
          workflow_id: workflow.id,
          result: { ok: true, data: { ops: [{ op_id: 'op-1', ...op }] } },
          children: [{ op_id: 'op-1', status: 'ok' }]
        }
      ],
      draft: host.projection()
    })
    await main(
      s.argv,
      s.page([
        launchSpan('turn-1', T0),
        turnRoot('turn-1', T0, T5),
        roundSpan('turn-1'),
        toolSpan('turn-1', 'call-1', true, T1, T2)
      ])
    )
    const conversation = s.written()
    expect(
      conversation.turns[0].response.map((entry) =>
        entry.kind === 'event' ? entry.event.type : entry.kind
      )
    ).toEqual([
      'agent_active_tab',
      'agent_tool_call',
      'graph_ops',
      'agent_tool_call',
      'agent_message_delta',
      'agent_message_done'
    ])
    expect(
      conversation.turns[0].response.find((entry) => entry.kind === 'graph_ops')
    ).toEqual({
      kind: 'graph_ops',
      ops: [op],
      at_ms: Date.parse(T2) - Date.parse(T0)
    })
    expect(assertOpsApply(conversation).projection()).toEqual(host.projection())
  })

  it('refuses a Langfuse host that carries credentials before the network or the disk', async () => {
    const s = stage('https://user:hunter2@langfuse.example')
    const fetchImpl = vi.fn()
    const failure = await main(s.argv, fetchImpl).catch(
      (error: unknown) => error
    )
    expect(failure).toBeInstanceOf(RecordRefusal)
    expect(failure instanceof RecordRefusal && failure.message).toBe(
      `Langfuse env file ${s.envPath}: LANGFUSE_HOST must not carry credentials`
    )
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(existsSync(s.workDir)).toBe(false)
  })
})
