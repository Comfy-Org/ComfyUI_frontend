import { describe, expect, it } from 'vitest'

import {
  AGENT_REPLAY_BUNDLE_VERSION,
  parseAgentReplayBundle
} from './agentReplayBundle'

const completeBundle = () => ({
  schema_version: AGENT_REPLAY_BUNDLE_VERSION,
  replay_id: 'b58a10d6-34c0-47f5-831e-40f1c19f398d',
  thread_id: 'e6a8a906-701d-437a-bdb0-78f24b44eb53',
  target: 'cloud',
  environment: 'staging',
  captured_at: '2026-10-09T12:00:00Z',
  expires_at: '2026-10-16T12:00:00Z',
  builds: { cloud: 'abc123', frontend: 'def456' },
  workflows: [
    {
      workflow_id: 'workflow-1',
      workflow: { nodes: [], links: [] },
      initial_doc_seq: 0
    }
  ],
  node_definitions: {},
  entries: [
    {
      kind: 'doc_frame',
      at_ms: 20,
      workflow_id: 'workflow-1',
      seq: 1,
      frame: { type: 'doc_update' }
    }
  ],
  final_graph_digests: { 'workflow-1': 'a'.repeat(64) },
  fidelity: { complete: true, level: 'full', reasons: [] }
})

describe('parseAgentReplayBundle', () => {
  it('accepts a complete v1 evidence bundle', () => {
    const input = completeBundle()
    expect(parseAgentReplayBundle(input)).toMatchObject({ ok: true })
  })

  it('returns a typed result for an unknown version', () => {
    expect(
      parseAgentReplayBundle({
        ...completeBundle(),
        schema_version: 'agent-replay-bundle.v2'
      })
    ).toMatchObject({ ok: false, reason: 'unsupported_version' })
  })

  it('rejects degraded fidelity without an explanation', () => {
    const input = completeBundle()
    input.fidelity = { complete: false, level: 'degraded', reasons: [] }
    expect(parseAgentReplayBundle(input)).toMatchObject({
      ok: false,
      reason: 'invalid_bundle'
    })
  })

  it('rejects document frames for workflows absent from the snapshot set', () => {
    const input = completeBundle()
    input.entries[0].workflow_id = 'missing'
    expect(parseAgentReplayBundle(input)).toMatchObject({
      ok: false,
      reason: 'invalid_bundle'
    })
  })

  it('rejects an empty complete replay', () => {
    const input = completeBundle()
    input.entries = []
    expect(parseAgentReplayBundle(input)).toMatchObject({
      ok: false,
      reason: 'invalid_bundle'
    })
  })

  it('rejects entries that move backward in time', () => {
    const input = completeBundle()
    input.entries.push({
      kind: 'doc_frame',
      at_ms: 5,
      workflow_id: 'workflow-1',
      seq: 2,
      frame: { type: 'doc_update' }
    })
    expect(parseAgentReplayBundle(input)).toMatchObject({
      ok: false,
      reason: 'invalid_bundle'
    })
  })
})
