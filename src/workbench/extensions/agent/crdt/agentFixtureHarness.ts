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

export function parseAgentResponseFixture(
  value: unknown
): AgentResponseFixture {
  if (!isRecord(value) || typeof value.scenario !== 'string') {
    throw new Error('Invalid agent response fixture: scenario must be a string')
  }
  if (!Array.isArray(value.frames) || value.frames.length === 0) {
    throw new Error('Invalid agent response fixture: frames must be non-empty')
  }
  if (!value.frames.every(isDraftPatchFrame)) {
    throw new Error(
      'Invalid agent response fixture: malformed draft_patch frame'
    )
  }

  return { scenario: value.scenario, frames: value.frames }
}

function isDraftPatchFrame(value: unknown): value is DraftPatchFrame {
  if (
    !isRecord(value) ||
    value.type !== 'draft_patch' ||
    !isRecord(value.data)
  ) {
    return false
  }

  const { data } = value
  return (
    typeof data.message_id === 'string' &&
    typeof data.thread_id === 'string' &&
    isFixtureWorkflow(data.content)
  )
}

function isFixtureWorkflow(value: unknown): value is FixtureWorkflow {
  return (
    isRecord(value) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isFixtureNode)
  )
}

function isFixtureNode(value: unknown): value is FixtureNode {
  return (
    isRecord(value) &&
    (typeof value.id === 'number' || typeof value.id === 'string') &&
    typeof value.type === 'string' &&
    Array.isArray(value.widgets_values)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
