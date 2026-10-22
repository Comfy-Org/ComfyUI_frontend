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

describe('parseAgentReplayBundle complete bundles', () => {
  it('accepts a complete v1 evidence bundle', () => {
    const input = completeBundle()
    expect(parseAgentReplayBundle(input)).toEqual({ ok: true, bundle: input })
  })
})

describe('parseAgentReplayBundle basic validation', () => {
  it('returns a typed result for an unknown version', () => {
    expect(
      parseAgentReplayBundle({
        ...completeBundle(),
        schema_version: 'agent-replay-bundle.v2'
      })
    ).toMatchObject({ ok: false, reason: 'unsupported_version' })
  })

  it('reports a non-string version as an invalid bundle', () => {
    expect(
      parseAgentReplayBundle({
        ...completeBundle(),
        schema_version: { toString: 1 }
      })
    ).toMatchObject({ ok: false, reason: 'invalid_bundle' })
  })

  it('requires a final digest for every workflow only at full fidelity', () => {
    const missingDigests = { ...completeBundle(), final_graph_digests: {} }
    expect(parseAgentReplayBundle(missingDigests)).toMatchObject({
      ok: false,
      reason: 'invalid_bundle'
    })
    expect(
      parseAgentReplayBundle({
        ...missingDigests,
        fidelity: {
          complete: false,
          level: 'degraded',
          reasons: ['final digest unavailable']
        }
      })
    ).toMatchObject({ ok: true })
  })

  it('rejects degraded fidelity without an explanation', () => {
    const input = completeBundle()
    input.fidelity = { complete: false, level: 'degraded', reasons: [] }
    expect(parseAgentReplayBundle(input)).toMatchObject({
      ok: false,
      reason: 'invalid_bundle'
    })
  })

  it('rejects full fidelity that still lists degradation reasons', () => {
    expect(
      parseAgentReplayBundle({
        ...completeBundle(),
        fidelity: {
          complete: true,
          level: 'full',
          reasons: ['missing node definitions']
        }
      })
    ).toMatchObject({ ok: false, reason: 'invalid_bundle' })
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
})

describe('parseAgentReplayBundle workflow validation', () => {
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

  it('rejects duplicate workflow snapshots', () => {
    const input = completeBundle()
    input.workflows.push({ ...input.workflows[0] })
    expect(parseAgentReplayBundle(input)).toMatchObject({
      ok: false,
      reason: 'invalid_bundle'
    })
  })

  it('rejects a first document frame already covered by the snapshot', () => {
    const input = completeBundle()
    input.workflows[0].initial_doc_seq = 5
    input.entries[0].seq = 5
    expect(parseAgentReplayBundle(input)).toMatchObject({
      ok: false,
      reason: 'invalid_bundle'
    })
    input.entries[0].seq = 6
    expect(parseAgentReplayBundle(input)).toMatchObject({ ok: true })
  })

  it('rejects document frames that do not advance within a workflow', () => {
    const input = completeBundle()
    input.entries.push({
      kind: 'doc_frame',
      at_ms: 30,
      workflow_id: 'workflow-1',
      seq: 1,
      frame: { type: 'doc_update' }
    })
    expect(parseAgentReplayBundle(input)).toMatchObject({
      ok: false,
      reason: 'invalid_bundle'
    })
  })

  it('allows independently increasing document frames for each workflow', () => {
    const input = completeBundle()
    input.workflows.push({
      workflow_id: 'workflow-2',
      workflow: { nodes: [], links: [] },
      initial_doc_seq: 0
    })
    input.entries.push({
      kind: 'doc_frame',
      at_ms: 30,
      workflow_id: 'workflow-2',
      seq: 1,
      frame: { type: 'doc_update' }
    })
    ;(input.final_graph_digests as Record<string, string>)['workflow-2'] =
      'b'.repeat(64)
    expect(parseAgentReplayBundle(input)).toEqual({ ok: true, bundle: input })
  })
})
