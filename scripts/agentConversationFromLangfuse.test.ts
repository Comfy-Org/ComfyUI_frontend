import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { Observation } from './agentConversationFromLangfuse'
import {
  attributeOf,
  captureFromObservations,
  fetchObservations,
  readEnvFile
} from './agentConversationFromLangfuse'

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

const turnRoot = (turnId: string, start: string, end: string): Observation =>
  span(
    `root-${turnId}`,
    { 'comfy.thread_id': THREAD, 'comfy.turn_id': turnId },
    {
      name: 'agent.turn',
      startTime: start,
      endTime: end,
      input: 'Add a sampler',
      output: 'Added a KSampler.'
    }
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
      'comfy.thread_id': THREAD,
      'comfy.turn_id': turnId,
      'gen_ai.tool.call.id': callId,
      'gen_ai.tool.name': 'apply_ops',
      'comfy.tool.ok': ok
    },
    {
      name: 'agent.tool apply_ops',
      startTime: start,
      endTime: end,
      parentObservationId: `root-${turnId}`
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
  it('rebuilds the frames of a turn from its tool spans and output', () => {
    const raw = captureFromObservations(
      [
        toolSpan(
          'message-1',
          'tool-1',
          true,
          '2026-09-04T10:00:00.200Z',
          '2026-09-04T10:00:00.700Z'
        ),
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
        },
        saw_done: true
      }
    ])
    expect(
      raw.frames.map((frame) => [frame.type, frame.data.status, frame.at_ms])
    ).toEqual([
      ['agent_tool_call', 'running', Date.parse('2026-09-04T10:00:00.200Z')],
      ['agent_tool_call', 'success', Date.parse('2026-09-04T10:00:00.700Z')],
      [
        'agent_message_delta',
        undefined,
        Date.parse('2026-09-04T10:00:01.000Z')
      ],
      ['agent_message_done', undefined, Date.parse('2026-09-04T10:00:01.000Z')]
    ])
    expect(raw.frames[0].data).toMatchObject({
      thread_id: THREAD,
      message_id: 'message-1',
      tool_call_id: 'tool-1',
      tool_name: 'apply_ops'
    })
    expect(raw.frames[2].data.delta).toBe('Added a KSampler.')
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

  it('ignores spans of other threads and refuses when none match', () => {
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

  it('refuses on a non-2xx page', async () => {
    await expect(
      fetchObservations(
        env,
        { traceId: 'trace-1' },
        async () => new Response('nope', { status: 401 })
      )
    ).rejects.toThrow('returned 401')
  })
})
