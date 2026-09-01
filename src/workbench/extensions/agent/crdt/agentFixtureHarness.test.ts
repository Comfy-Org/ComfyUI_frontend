import { describe, expect, it, vi } from 'vitest'

import addNodeFixture from './__fixtures__/add-node.json'
import type {
  AgentFixtureAdapter,
  AgentResponseFixture,
  FixtureNode,
  FixtureWorkflow,
  RemoteMutationContext
} from './agentFixtureHarness'
import { replayAgentFixture } from './agentFixtureHarness'

class TestGraphAdapter implements AgentFixtureAdapter {
  readonly nodes = new Map<FixtureNode['id'], FixtureNode>()
  readonly emitLocalOp = vi.fn()
  private activeContext: RemoteMutationContext | undefined

  readonly graphMutations = {
    batch: (context: RemoteMutationContext, apply: () => void): void => {
      this.activeContext = context
      try {
        apply()
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
      if (context.source !== 'agent-remote') this.emitLocalOp(node)
    }
  }
}

describe('replayAgentFixture', () => {
  it('applies an add-node response with call-carried echo suppression', () => {
    const adapter = new TestGraphAdapter()

    replayAgentFixture(
      addNodeFixture as AgentResponseFixture,
      adapter,
      'fixture-actor'
    )

    expect(adapter.nodes.get(1)).toMatchObject({
      type: 'LoadImage',
      widgets_values: ['reference.png', 'image']
    })
    expect(adapter.emitLocalOp).not.toHaveBeenCalled()
  })
})
