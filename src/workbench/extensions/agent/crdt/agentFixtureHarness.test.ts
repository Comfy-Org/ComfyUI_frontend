import { describe, expect, it } from 'vitest'

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
  readonly contexts: RemoteMutationContext[] = []
  private activeContext: RemoteMutationContext | undefined

  constructor(private readonly acceptsBatch = true) {}

  readonly graphMutations = {
    batch: (context: RemoteMutationContext, apply: () => void): boolean => {
      if (!this.acceptsBatch) return false
      this.contexts.push(context)
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
  it('applies an add-node response with canonical remote provenance', () => {
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
    expect(adapter.contexts).toEqual([
      {
        source: 'agent-remote',
        actor: 'fixture-actor',
        opId: 'fixture-message-add-node:11'
      }
    ])
  })

  it('rejects a fixture batch that cannot be applied', () => {
    const adapter = new TestGraphAdapter(false)

    expect(() =>
      replayAgentFixture(parseAgentResponseFixture(addNodeFixture), adapter)
    ).toThrow(
      'Agent response fixture batch rejected: fixture-message-add-node:11'
    )
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

  it('ignores well-formed non-draft frames in a captured stream', () => {
    const parsed = parseAgentResponseFixture({
      ...addNodeFixture,
      frames: [
        {
          type: 'agent_message_delta',
          data: { delta: 'Adding a node.' }
        },
        ...addNodeFixture.frames
      ]
    })

    expect(parsed.frames).toHaveLength(1)
    expect(parsed.frames[0].data.version).toBe(11)
  })

  it('rejects a captured stream without a draft patch', () => {
    expect(() =>
      parseAgentResponseFixture({
        scenario: 'message-only',
        frames: [{ type: 'agent_message_delta', data: { delta: 'Done.' } }]
      })
    ).toThrow('no draft_patch frames')
  })

  it('rejects non-contiguous draft patch versions', () => {
    const second = structuredClone(addNodeFixture.frames[0])
    second.data.base_version = 12
    second.data.version = 13

    expect(() =>
      parseAgentResponseFixture({
        ...addNodeFixture,
        frames: [...addNodeFixture.frames, second]
      })
    ).toThrow('non-contiguous draft patch versions')
  })

  it('rejects draft patches for different workflows', () => {
    const second = structuredClone(addNodeFixture.frames[0])
    second.data.base_version = 11
    second.data.version = 12
    second.data.workflow_id = 'another-workflow'

    expect(() =>
      parseAgentResponseFixture({
        ...addNodeFixture,
        frames: [...addNodeFixture.frames, second]
      })
    ).toThrow('workflow_id changed')
  })

  it('accepts nodes with omitted or named widget values', () => {
    const frame = addNodeFixture.frames[0]
    const node = frame.data.content.nodes[0]
    const nodeWithoutWidgets = Object.fromEntries(
      Object.entries(node).filter(([key]) => key !== 'widgets_values')
    )
    const fixtureWithNode = (fixtureNode: Record<string, unknown>) => ({
      ...addNodeFixture,
      frames: [
        {
          ...frame,
          data: {
            ...frame.data,
            content: { ...frame.data.content, nodes: [fixtureNode] }
          }
        }
      ]
    })

    expect(
      parseAgentResponseFixture(fixtureWithNode(nodeWithoutWidgets)).frames
    ).toHaveLength(1)
    expect(
      parseAgentResponseFixture(
        fixtureWithNode({ ...node, widgets_values: { image: 'reference.png' } })
      ).frames
    ).toHaveLength(1)
  })

  it('keeps workflow links available to the adapter', () => {
    const parsed = parseAgentResponseFixture(addNodeFixture)

    expect(parsed.frames[0].data.content).toMatchObject({
      last_node_id: 1,
      links: []
    })
  })

  it('returns a clone that is isolated from the imported fixture', () => {
    const source = structuredClone(addNodeFixture)
    const parsed = parseAgentResponseFixture(source)

    source.frames[0].data.content.nodes[0].type = 'MutatedAfterParse'

    expect(parsed.frames[0].data.content.nodes[0].type).toBe('LoadImage')
  })
})
