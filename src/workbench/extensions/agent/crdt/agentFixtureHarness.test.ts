import { describe, expect, it, vi } from 'vitest'

import addNodeFixture from './__fixtures__/add-node.json'
import type {
  AgentFixtureAdapter,
  FixtureNode,
  FixtureWorkflow,
  RemoteMutationContext
} from './agentFixtureHarness'
import {
  AgentFixtureError,
  parseAgentResponseFixture,
  replayAgentFixture
} from './agentFixtureHarness'

class TestGraphAdapter implements AgentFixtureAdapter {
  readonly nodes = new Map<FixtureNode['id'], FixtureNode>()
  readonly emitLocalOp = vi.fn()
  private activeContext: RemoteMutationContext | undefined

  constructor(private readonly acceptsBatch = true) {}

  readonly graphMutations = {
    batch: (context: RemoteMutationContext, apply: () => void): boolean => {
      if (!this.acceptsBatch) return false
      this.activeContext = context
      try {
        apply()
        return true
      } finally {
        this.activeContext = undefined
      }
    }
  }

  applyDraftPatch(
    workflow: FixtureWorkflow,
    context: RemoteMutationContext
  ): void {
    expect(context).toBe(this.activeContext)
    for (const node of workflow.nodes) {
      this.nodes.set(node.id, node)
    }
  }
}

describe('replayAgentFixture', () => {
  it('applies an add-node response with call-carried echo suppression', () => {
    const adapter = new TestGraphAdapter()

    replayAgentFixture(
      parseAgentResponseFixture(addNodeFixture),
      adapter,
      'fixture-actor'
    )

    expect(adapter.nodes.get(1)).toMatchObject({
      type: 'LoadImage',
      widgets_values: ['reference.png', 'image']
    })
    // Vacuous today, and deliberately left visible rather than deleted.
    // `replayAgentFixture` builds its context with `source: 'agent-remote'`
    // and `applyDraftPatch` is typed `RemoteMutationContext`, whose `source`
    // is the literal `'agent-remote'`. So no replay can produce a non-remote
    // context, and nothing can call `emitLocalOp` whatever the code under
    // test does. The guard that used to sit in `applyDraftPatch` was
    // unreachable for the same reason and was removed; `oxlint` flagged it as
    // a comparison between literal types.
    //
    // Making this assertion mean something requires the harness to be able to
    // replay a local context, which is a change to `agentFixtureHarness.ts`
    // rather than to this file.
    expect(adapter.emitLocalOp).not.toHaveBeenCalled()
  })

  it('rejects a fixture batch that cannot be applied', () => {
    const adapter = new TestGraphAdapter(false)

    expect(() =>
      replayAgentFixture(parseAgentResponseFixture(addNodeFixture), adapter)
    ).toThrow('Agent response fixture batch rejected: msg-add-node')
    expect(adapter.nodes).toHaveLength(0)
  })

  it('rejects a fixture with no scenario name', () => {
    expect(() => parseAgentResponseFixture({ frames: [] })).toThrow(
      AgentFixtureError
    )
    expect(() => parseAgentResponseFixture({ frames: [] })).toThrow(
      'scenario must be a string'
    )
  })

  it('rejects an empty frame list', () => {
    expect(() =>
      parseAgentResponseFixture({ scenario: 'empty', frames: [] })
    ).toThrow(AgentFixtureError)
    expect(() =>
      parseAgentResponseFixture({ scenario: 'empty', frames: [] })
    ).toThrow('frames must be non-empty')
  })

  it('rejects a frame with missing data', () => {
    expect(() =>
      parseAgentResponseFixture({
        scenario: 'malformed',
        frames: [{ type: 'draft_patch' }]
      })
    ).toThrow(AgentFixtureError)
    expect(() =>
      parseAgentResponseFixture({
        scenario: 'malformed',
        frames: [{ type: 'draft_patch' }]
      })
    ).toThrow('malformed draft_patch frame')
  })

  it('rejects a frame with an unknown type', () => {
    expect(() =>
      parseAgentResponseFixture({
        scenario: 'malformed',
        frames: [
          {
            type: 'unknown_frame_type',
            data: {
              message_id: 'msg-1',
              thread_id: 'thread-1',
              content: { nodes: [] }
            }
          }
        ]
      })
    ).toThrow('malformed draft_patch frame')
  })
})
