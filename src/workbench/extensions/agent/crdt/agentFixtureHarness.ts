export interface FixtureNode {
  readonly id: number | string
  readonly type: string
  readonly widgets_values: readonly unknown[]
}

export interface FixtureWorkflow {
  readonly nodes: readonly FixtureNode[]
}

interface DraftPatchFrame {
  readonly type: 'draft_patch'
  readonly data: {
    readonly message_id: string
    readonly thread_id: string
    readonly content: FixtureWorkflow
  }
}

export interface AgentResponseFixture {
  readonly scenario: string
  readonly frames: readonly DraftPatchFrame[]
}

export interface RemoteMutationContext {
  readonly source: 'agent-remote'
  readonly actor: string
  readonly op_id: string
}

export interface AgentFixtureAdapter {
  readonly graphMutations: {
    batch(context: RemoteMutationContext, apply: () => void): void
  }
  applyDraftPatch(
    workflow: FixtureWorkflow,
    context: RemoteMutationContext
  ): void
}

export function replayAgentFixture(
  fixture: AgentResponseFixture,
  adapter: AgentFixtureAdapter,
  actor = 'fixture-agent'
): void {
  for (const frame of fixture.frames) {
    const context: RemoteMutationContext = {
      source: 'agent-remote',
      actor,
      op_id: frame.data.message_id
    }

    adapter.graphMutations.batch(context, () => {
      adapter.applyDraftPatch(frame.data.content, context)
    })
  }
}
