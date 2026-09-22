import type { RemoteMutationContext } from '@/types/graphMutationContext'

export type { RemoteMutationContext } from '@/types/graphMutationContext'

export interface FixtureNode {
  readonly id: number | string
  readonly type: string
  readonly inputs?: readonly unknown[]
  readonly outputs?: readonly unknown[]
  readonly widgets_values?:
    | readonly unknown[]
    | Readonly<Record<string, unknown>>
}

export interface FixtureWorkflow {
  readonly last_node_id: number
  readonly links: readonly unknown[]
  readonly nodes: readonly FixtureNode[]
}

interface DraftPatchFrame {
  readonly type: 'draft_patch'
  readonly data: {
    readonly base_version: number
    readonly version: number
    readonly workflow_id: string
    readonly message_id: string
    readonly thread_id: string
    readonly content: FixtureWorkflow
  }
}

export interface AgentResponseFixture {
  readonly scenario: string
  readonly frames: readonly DraftPatchFrame[]
}

/**
 * Thrown by {@link parseAgentResponseFixture} when a fixture file does not
 * describe a replayable agent response.
 *
 * A named subclass rather than a bare `Error`: `comfy/no-new-error-throw`
 * (ADR `TELEMETRY-DIAGNOSTICS-0019`) forbids `throw new Error(...)` under
 * `src/`, and the sibling read-time gate in this same directory
 * (`FollowerSchemaError` in `schemaGuard.ts`) already carries that pattern.
 * The diagnostics contract itself is deliberately NOT used here: `assert`
 * throws only under DEV, and a malformed fixture must fail the test run in
 * every environment.
 */
export class AgentFixtureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentFixtureError'
  }
}

export function parseAgentResponseFixture(
  value: unknown
): AgentResponseFixture {
  if (!isRecord(value) || typeof value.scenario !== 'string') {
    throw new AgentFixtureError(
      'Invalid agent response fixture: scenario must be a string'
    )
  }
  if (!Array.isArray(value.frames) || value.frames.length === 0) {
    throw new AgentFixtureError(
      'Invalid agent response fixture: frames must be non-empty'
    )
  }
  const frames = collectDraftPatchFrames(value.frames)

  assertContiguousDraftPatches(frames)
  return structuredClone({ scenario: value.scenario, frames })
}

function collectDraftPatchFrames(values: readonly unknown[]): DraftPatchFrame[] {
  const frames = values.filter(isDraftPatchCandidate)
  if (!frames.every(isDraftPatchFrame)) {
    throw new AgentFixtureError(
      'Invalid agent response fixture: malformed draft_patch frame'
    )
  }
  if (frames.length === 0) {
    throw new AgentFixtureError(
      'Invalid agent response fixture: no draft_patch frames'
    )
  }
  return frames
}

function assertContiguousDraftPatches(frames: readonly DraftPatchFrame[]): void {
  const workflowId = frames[0].data.workflow_id
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1].data
    const current = frames[index].data
    if (current.workflow_id !== workflowId) {
      throw new AgentFixtureError(
        'Invalid agent response fixture: workflow_id changed between draft patches'
      )
    }
    if (current.base_version !== previous.version) {
      throw new AgentFixtureError(
        'Invalid agent response fixture: non-contiguous draft patch versions'
      )
    }
  }
}

function isDraftPatchCandidate(
  value: unknown
): value is Record<string, unknown> & { type: 'draft_patch' } {
  return isRecord(value) && value.type === 'draft_patch'
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
    typeof data.base_version === 'number' &&
    typeof data.version === 'number' &&
    typeof data.workflow_id === 'string' &&
    typeof data.message_id === 'string' &&
    typeof data.thread_id === 'string' &&
    isFixtureWorkflow(data.content)
  )
}

function isFixtureWorkflow(value: unknown): value is FixtureWorkflow {
  return (
    isRecord(value) &&
    typeof value.last_node_id === 'number' &&
    Array.isArray(value.links) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isFixtureNode)
  )
}

function isFixtureNode(value: unknown): value is FixtureNode {
  return (
    isRecord(value) &&
    (typeof value.id === 'number' || typeof value.id === 'string') &&
    typeof value.type === 'string' &&
    isOptionalArray(value.inputs) &&
    isOptionalArray(value.outputs) &&
    isOptionalWidgetValues(value.widgets_values)
  )
}

function isOptionalArray(
  value: unknown
): value is readonly unknown[] | undefined {
  return value === undefined || Array.isArray(value)
}

function isOptionalWidgetValues(
  value: unknown
): value is FixtureNode['widgets_values'] {
  return value === undefined || Array.isArray(value) || isRecord(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface AgentFixtureAdapter {
  readonly graphMutations: {
    batch(context: RemoteMutationContext, apply: () => void): boolean
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
      opId: `${frame.data.message_id}:${frame.data.version}`
    }

    const applied = adapter.graphMutations.batch(context, () => {
      adapter.applyDraftPatch(frame.data.content, context)
    })
    if (!applied) {
      throw new AgentFixtureError(
        `Agent response fixture batch rejected: ${context.opId}`
      )
    }
  }
}
