import { describe, expect, it } from 'vitest'
import { Window } from 'happy-dom'

import { parseAgentReplayBundle } from './agentReplayBundle'
import { renderAgentReplayDocument } from './renderAgentReplayDocument'

function transcriptBundle() {
  return {
    schema_version: 'agent-replay-bundle.v1',
    replay_id: 'b58a10d6-34c0-47f5-831e-40f1c19f398d',
    thread_id: 'e6a8a906-701d-437a-bdb0-78f24b44eb53',
    target: 'cloud',
    environment: 'staging',
    captured_at: '2026-11-20T01:00:00Z',
    expires_at: '2026-11-20T01:15:00Z',
    builds: { cloud: 'abc123', frontend: 'unknown' },
    workflows: [],
    node_definitions: {},
    entries: [
      {
        kind: 'visible_event',
        at_ms: 0,
        event: {
          type: 'agent_message',
          role: 'user',
          content: { text: '<script>unsafe()</script>' }
        }
      },
      {
        kind: 'tool_outcome',
        at_ms: 2500,
        tool_call_id: 'call-1',
        tool_name: 'edit_workflow',
        status: 'succeeded'
      }
    ],
    final_graph_digests: {},
    fidelity: {
      complete: false,
      level: 'degraded',
      reasons: ['historical_workflow_baseline_unavailable']
    }
  }
}

describe('renderAgentReplayDocument', () => {
  it('renders a deterministic transcript-only timeline without trusting content as HTML', () => {
    const parsed = parseAgentReplayBundle(transcriptBundle())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const rendered = renderAgentReplayDocument(parsed.bundle)

    expect(rendered.fidelity).toBe('transcript_only')
    expect(rendered.durationMs).toBe(2500)
    expect(rendered.html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;')
    expect(rendered.html).not.toContain('<script>unsafe()</script>')
    expect(rendered.html).toContain('data-at-ms="2500"')
    expect(rendered.html).toContain('historical_workflow_baseline_unavailable')

    const window = new Window()
    window.document.write(rendered.html)
    const replayScript = window.document.querySelector('script')
    expect(replayScript).not.toBeNull()
    window.eval(replayScript?.textContent ?? '')
    const entries = [...window.document.querySelectorAll('[data-at-ms]')].map(
      (entry) => entry as unknown as { hidden: boolean }
    )
    const setReplayTime = (
      window as unknown as { setReplayTime: (milliseconds: number) => void }
    ).setReplayTime
    expect(entries.map((entry) => entry.hidden)).toEqual([false, true])

    setReplayTime(2500)
    expect(entries.map((entry) => entry.hidden)).toEqual([false, false])

    setReplayTime(0)
    expect(entries.map((entry) => entry.hidden)).toEqual([false, true])
  })

  it('classifies degraded graph evidence separately from full fidelity', () => {
    const degraded = {
      ...transcriptBundle(),
      workflows: [
        {
          workflow_id: 'workflow-1',
          workflow: {},
          initial_doc_seq: 0
        }
      ]
    }
    const parsed = parseAgentReplayBundle(degraded)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(renderAgentReplayDocument(parsed.bundle).fidelity).toBe('panel_only')
  })

  it('does not claim faithful replay before graph evidence is verified', () => {
    const full = {
      ...transcriptBundle(),
      workflows: [
        {
          workflow_id: 'workflow-1',
          workflow: {},
          initial_doc_seq: 0
        }
      ],
      final_graph_digests: {
        'workflow-1': '0'.repeat(64)
      },
      fidelity: {
        complete: true,
        level: 'full',
        reasons: []
      }
    }
    const parsed = parseAgentReplayBundle(full)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(renderAgentReplayDocument(parsed.bundle).fidelity).toBe('panel_only')
  })
})
