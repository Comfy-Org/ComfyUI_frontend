import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { RawCapture } from './agentConversationAssemble'
import {
  openStream,
  readRows,
  writeRefusalArtifacts
} from './agentConversationRecord'

const SECRET = 'postgres://recorder:sentinel-secret@localhost/agent'

const rawCapture = (): RawCapture => ({
  case_id: 'secret-boundary',
  attempt: 'a1',
  base: 'http://127.0.0.1:8086',
  frame_source: 'redis SUBSCRIBE channel:ws:<workspace>:u:<user>',
  channel: 'channel:ws:workspace:user',
  seed_sha256: 'a'.repeat(64),
  seed_name: 'seed',
  seed_node_ids: [],
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
})

describe('recorder subprocess boundaries', () => {
  it('suppresses Postgres arguments before refusal artifacts or stderr', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'agent-recorder-'))
    const raw = rawCapture()
    const paths = {
      fixture: join(workDir, 'fixture.json'),
      raw: join(workDir, 'recording.raw.json'),
      rows: join(workDir, 'recording.rows.json'),
      capture: join(workDir, 'recording.capture.json'),
      receipt: join(workDir, 'recording.receipt.json'),
      refusal: join(workDir, 'recording.refused.jsonl')
    }

    let failure: unknown
    try {
      readRows(['/missing-postgres-command', SECRET], paths.rows, {
        threadId: 'thread',
        messageId: 'message',
        workflowId: 'workflow'
      })
    } catch (error) {
      failure = error
    }

    const stderr = `record: REFUSED: ${writeRefusalArtifacts(
      raw,
      paths.raw,
      paths.refusal,
      failure,
      [SECRET]
    )}`
    const persisted = [paths.raw, paths.refusal]
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')

    expect(failure).toHaveProperty(
      'message',
      'Postgres command failed; subprocess details suppressed'
    )
    expect(`${persisted}\n${stderr}`).not.toContain(SECRET)
    expect(
      [paths.fixture, paths.rows, paths.capture, paths.receipt].some(existsSync)
    ).toBe(false)
  })

  it('suppresses Redis spawn errors and does not inherit child stderr', async () => {
    const raw = rawCapture()
    const stop = openStream(raw, ['/missing-redis-command', SECRET], () => {})

    await vi.waitFor(() => expect(raw.error).not.toBeNull())
    stop()

    expect(raw.error).toBe(
      'Redis command failed to start; subprocess details suppressed'
    )
    expect(JSON.stringify(raw)).not.toContain(SECRET)
  })
})
