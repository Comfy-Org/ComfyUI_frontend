import { describe, expect, it, vi } from 'vitest'

import addNodeFixture from './__fixtures__/add-node.json'
import multiFrameSequenceFixture from './__fixtures__/multi-frame-sequence.json'
import multiNodeBatchFixture from './__fixtures__/multi-node-batch.json'
import multiNodeFixture from './__fixtures__/multi-node.json'
import mutateMultiWidgetFixture from './__fixtures__/mutate-multi-widget.json'
import mutateWidgetStringFixture from './__fixtures__/mutate-widget-string.json'
import mutateWidgetFixture from './__fixtures__/mutate-widget.json'
import noOpPatchFixture from './__fixtures__/no-op-patch.json'
import type {
  AgentFixtureAdapter,
  AgentResponseFixture,
  FixtureNode,
  RemoteMutationContext
} from './agentFixtureHarness'
import { replayAgentFixture } from './agentFixtureHarness'

/** Layout fields the fixtures carry but the harness applier does not read. */
interface PositionedNode extends FixtureNode {
  readonly pos: readonly [number, number]
  readonly size: readonly [number, number]
}

class TestGraphAdapter implements AgentFixtureAdapter {
  readonly nodes = new Map<FixtureNode['id'], FixtureNode>()
  readonly emitLocalOp = vi.fn()
  /** One entry per replayed frame, in frame order. */
  readonly contexts: RemoteMutationContext[] = []
  /** Graph state captured after each frame, for incremental assertions. */
  readonly snapshots: Map<FixtureNode['id'], FixtureNode>[] = []
  private activeContext: RemoteMutationContext | undefined

  readonly graphMutations = {
    batch: (context: RemoteMutationContext, apply: () => void): void => {
      this.activeContext = context
      this.contexts.push(context)
      try {
        apply()
      } finally {
        this.activeContext = undefined
        this.snapshots.push(new Map(this.nodes))
      }
    }
  }

  applyDraftPatch(
    workflow: { readonly nodes: readonly FixtureNode[] },
    context: RemoteMutationContext
  ): void {
    expect(context).toBe(this.activeContext)
    for (const node of workflow.nodes) {
      this.nodes.set(node.id, node)
      if (context.source !== 'agent-remote') this.emitLocalOp(node)
    }
  }
}

const ACTOR = 'fixture-actor'

function replay(fixture: unknown): TestGraphAdapter {
  const adapter = new TestGraphAdapter()
  replayAgentFixture(fixture as AgentResponseFixture, adapter, ACTOR)
  return adapter
}

function opIds(adapter: TestGraphAdapter): string[] {
  return adapter.contexts.map((context) => context.op_id)
}

/** Every frame must run as a suppressed remote batch authored by ACTOR. */
function expectRemoteBatches(adapter: TestGraphAdapter, frames: number): void {
  expect(adapter.contexts).toHaveLength(frames)
  for (const context of adapter.contexts) {
    expect(context.source).toBe('agent-remote')
    expect(context.actor).toBe(ACTOR)
  }
  expect(adapter.emitLocalOp).not.toHaveBeenCalled()
}

function positioned(
  adapter: TestGraphAdapter,
  id: FixtureNode['id']
): PositionedNode {
  const node = adapter.nodes.get(id)
  expect(node).toBeDefined()
  return node as PositionedNode
}

function overlaps(a: PositionedNode, b: PositionedNode): boolean {
  return (
    a.pos[0] < b.pos[0] + b.size[0] &&
    b.pos[0] < a.pos[0] + a.size[0] &&
    a.pos[1] < b.pos[1] + b.size[1] &&
    b.pos[1] < a.pos[1] + a.size[1]
  )
}

const ALL_FIXTURES: ReadonlyArray<
  readonly [string, unknown, readonly string[]]
> = [
  ['add-node', addNodeFixture, ['fixture-message-add-node']],
  ['multi-node', multiNodeFixture, ['fixture-message-multi-node']],
  ['mutate-widget', mutateWidgetFixture, ['fixture-message-mutate-widget']],
  [
    'mutate-widget-string',
    mutateWidgetStringFixture,
    ['fixture-message-mutate-widget-string']
  ],
  [
    'mutate-multi-widget',
    mutateMultiWidgetFixture,
    ['fixture-message-mutate-multi-widget']
  ],
  [
    'multi-node-batch',
    multiNodeBatchFixture,
    ['fixture-message-multi-node-batch']
  ],
  [
    'multi-frame-sequence',
    multiFrameSequenceFixture,
    ['fixture-message-sequence-frame-1', 'fixture-message-sequence-frame-2']
  ],
  ['no-op-patch', noOpPatchFixture, ['fixture-message-no-op']]
]

describe('replayAgentFixture', () => {
  it('applies an add-node response with call-carried echo suppression', () => {
    const adapter = replay(addNodeFixture)

    expect(adapter.nodes.get(1)).toMatchObject({
      type: 'LoadImage',
      widgets_values: ['reference.png', 'image']
    })
    expectRemoteBatches(adapter, 1)
    expect(opIds(adapter)).toEqual(['fixture-message-add-node'])
  })

  it('applies a two-node linked response', () => {
    const adapter = replay(multiNodeFixture)

    expect([...adapter.nodes.keys()]).toEqual([1, 2])
    expect(adapter.nodes.get(1)).toMatchObject({ type: 'LoadImage' })
    expect(adapter.nodes.get(2)).toMatchObject({
      type: 'SaveImage',
      widgets_values: ['agent-fixture']
    })
    expectRemoteBatches(adapter, 1)
    expect(opIds(adapter)).toEqual(['fixture-message-multi-node'])
  })

  it('applies a mixed numeric/string widget mutation', () => {
    const adapter = replay(mutateWidgetFixture)

    expect(adapter.nodes.get(1)).toMatchObject({
      type: 'KSampler',
      widgets_values: [42, 'fixed', 12, 6.5, 'euler', 'normal', 1]
    })
    expectRemoteBatches(adapter, 1)
    expect(opIds(adapter)).toEqual(['fixture-message-mutate-widget'])
  })

  it('applies an all-string widget mutation', () => {
    const adapter = replay(mutateWidgetStringFixture)

    const node = adapter.nodes.get(1)
    expect(node).toMatchObject({
      type: 'CLIPTextEncode',
      widgets_values: ['a cinematic photograph of a red bicycle']
    })
    expect(node?.widgets_values.every((v) => typeof v === 'string')).toBe(true)
    expectRemoteBatches(adapter, 1)
    expect(opIds(adapter)).toEqual(['fixture-message-mutate-widget-string'])
  })

  it('applies mutations to several nodes inside one frame', () => {
    const adapter = replay(mutateMultiWidgetFixture)

    expect([...adapter.nodes.keys()]).toEqual([1, 2])
    expect(adapter.nodes.get(1)).toMatchObject({
      type: 'KSampler',
      widgets_values: [7, 'randomize', 24, 8.5, 'dpmpp_2m', 'karras', 1]
    })
    expect(adapter.nodes.get(2)).toMatchObject({
      type: 'CLIPTextEncode',
      widgets_values: ['a studio portrait, soft rim light']
    })
    // Both mutations land in a single batch, not one batch per node.
    expectRemoteBatches(adapter, 1)
    expect(opIds(adapter)).toEqual(['fixture-message-mutate-multi-widget'])
  })

  it('applies a seven-node batch with non-overlapping layout bounds', () => {
    const adapter = replay(multiNodeBatchFixture)

    expect([...adapter.nodes.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(adapter.nodes.get(1)).toMatchObject({
      type: 'CheckpointLoaderSimple'
    })
    expect(adapter.nodes.get(5)).toMatchObject({ type: 'KSampler' })
    expect(adapter.nodes.get(7)).toMatchObject({
      type: 'SaveImage',
      widgets_values: ['agent-fixture-batch']
    })

    const ids: FixtureNode['id'][] = [1, 2, 3, 4, 5, 6, 7]
    const collisions: string[] = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positioned(adapter, ids[i])
        const b = positioned(adapter, ids[j])
        if (overlaps(a, b)) collisions.push(`${ids[i]}/${ids[j]}`)
      }
    }
    expect(collisions).toEqual([])

    expectRemoteBatches(adapter, 1)
    expect(opIds(adapter)).toEqual(['fixture-message-multi-node-batch'])
  })

  it('applies a multi-frame sequence incrementally in frame order', () => {
    const adapter = replay(multiFrameSequenceFixture)

    const [afterFirst, afterSecond] = adapter.snapshots
    expect(adapter.snapshots).toHaveLength(2)

    // Frame 1 adds only node 1, with its original widget value.
    expect([...afterFirst.keys()]).toEqual([1])
    expect(afterFirst.get(1)).toMatchObject({
      type: 'LoadImage',
      widgets_values: ['reference.png', 'image']
    })

    // Frame 2 mutates node 1 and adds node 2.
    expect([...afterSecond.keys()]).toEqual([1, 2])
    expect(afterSecond.get(1)).toMatchObject({
      widgets_values: ['updated-reference.png', 'image']
    })
    expect(afterSecond.get(2)).toMatchObject({
      type: 'SaveImage',
      widgets_values: ['agent-fixture-sequence']
    })

    expectRemoteBatches(adapter, 2)
    expect(opIds(adapter)).toEqual([
      'fixture-message-sequence-frame-1',
      'fixture-message-sequence-frame-2'
    ])
  })

  it('applies an empty draft patch without mutating or emitting anything', () => {
    const adapter = replay(noOpPatchFixture)

    expect(adapter.nodes.size).toBe(0)
    expect(adapter.snapshots).toHaveLength(1)
    expect(adapter.snapshots[0].size).toBe(0)
    // The frame still runs as a batch: a no-op patch is applied, not skipped.
    expectRemoteBatches(adapter, 1)
    expect(opIds(adapter)).toEqual(['fixture-message-no-op'])
  })

  it.for(ALL_FIXTURES)(
    'derives stable op_ids from message_id for %s',
    ([, fixture, expected]) => {
      expect(opIds(replay(fixture))).toEqual(expected)
      // Same fixture, fresh adapter: identity must not drift between replays.
      expect(opIds(replay(fixture))).toEqual(expected)
    }
  )
})
