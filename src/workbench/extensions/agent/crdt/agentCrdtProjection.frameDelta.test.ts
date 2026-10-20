import { nodesMap } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'
import { LiveGraphApplier } from './liveGraphApplier'

const WORKFLOW_ID = 'wf-a'
type GraphGetter = ConstructorParameters<typeof AgentCrdtProjection>[0]
type ProjectionGraph = ReturnType<GraphGetter>

function frame(seq: number, source: Y.Doc, since?: Uint8Array) {
  return {
    workflowId: WORKFLOW_ID,
    seq,
    update: Y.encodeStateAsUpdate(source, since),
    actor: 'agent:comfy:host',
    opIds: []
  }
}

function setup(graph: ProjectionGraph = null) {
  const host = new Y.Doc()
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind(WORKFLOW_ID, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
    host.destroy()
  })
  return { host, follower, projection }
}

describe('AgentCrdtProjection frame node delta', () => {
  it('reports each pending document node change once while no graph is bound', () => {
    const { host, follower, projection } = setup()
    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    nodesMap(host).set('4', new Y.Map([['type', 'Note']]))
    const first = frame(1, host)
    follower.applyRemoteUpdate(first.update)

    expect(projection.applyFrame(first)).toEqual({
      applied: false,
      nodes: { added: ['3', '4'], removed: [] }
    })

    const before = Y.encodeStateVector(host)
    nodesMap(host).delete('3')
    const second = frame(2, host, before)
    follower.applyRemoteUpdate(second.update)

    expect(projection.applyFrame(second)).toEqual({
      applied: false,
      nodes: { added: [], removed: ['3'] }
    })
    expect(projection.discardPending(WORKFLOW_ID)).toEqual({
      added: ['4'],
      removed: ['3']
    })
    expect(projection.applyFrame(second)).toEqual({
      applied: false,
      nodes: { added: [], removed: [] }
    })
  })

  it('reports the delta of a discarded echo and leaves nothing for the next frame', () => {
    const { host, follower, projection } = setup()
    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    follower.applyRemoteUpdate(Y.encodeStateAsUpdate(host))

    expect(projection.discardPending(WORKFLOW_ID)).toEqual({
      added: ['3'],
      removed: []
    })
    expect(projection.applyFrame(frame(2, host))).toEqual({
      applied: false,
      nodes: { added: [], removed: [] }
    })
  })

  it('reports an empty, unapplied outcome for a workflow it is not bound to', () => {
    const { host, projection } = setup()

    expect(
      projection.applyFrame({ ...frame(1, host), workflowId: 'wf-other' })
    ).toEqual({ applied: false, nodes: { added: [], removed: [] } })
    expect(projection.discardPending('wf-other')).toEqual({
      added: [],
      removed: []
    })
  })

  it('retains a failed projection until a clean retry applies it', () => {
    const graph = fromPartial<NonNullable<ProjectionGraph>>({})
    const applyChanges = vi
      .spyOn(LiveGraphApplier.prototype, 'applyChanges')
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 1 })
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 1 })
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 0 })
    const { host, follower, projection } = setup(graph)
    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    const update = frame(1, host)
    follower.applyRemoteUpdate(update.update)

    expect(projection.applyFrame(update)).toMatchObject({
      applied: true,
      failureCount: 1
    })
    expect(projection.retryFailed(WORKFLOW_ID)).toMatchObject({
      applied: true,
      failureCount: 1
    })
    expect(projection.hasPendingFailure(WORKFLOW_ID)).toBe(true)

    expect(projection.retryFailed(WORKFLOW_ID)).toMatchObject({
      applied: true,
      failureCount: 0
    })
    expect(projection.hasPendingFailure(WORKFLOW_ID)).toBe(false)
    expect(projection.retryFailed(WORKFLOW_ID)).toBeNull()
    expect(applyChanges).toHaveBeenCalledTimes(3)
    expect(applyChanges.mock.calls[2][1]).toEqual(applyChanges.mock.calls[0][1])
  })

  it('re-derives a retained delete against the document before replaying it', () => {
    const graph = fromPartial<NonNullable<ProjectionGraph>>({})
    const applyChanges = vi
      .spyOn(LiveGraphApplier.prototype, 'applyChanges')
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 0 })
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 1 })
      .mockReturnValue({ createdNodeIds: [], failureCount: 0 })
    const { host, follower, projection } = setup(graph)

    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    const seed = frame(1, host)
    follower.applyRemoteUpdate(seed.update)
    projection.applyFrame(seed)

    let since = Y.encodeStateVector(host)
    nodesMap(host).delete('3')
    const removal = frame(2, host, since)
    follower.applyRemoteUpdate(removal.update)

    expect(projection.applyFrame(removal)).toMatchObject({ failureCount: 1 })
    expect(applyChanges.mock.calls[1][1].nodes.get('3')).toBe('delete')

    since = Y.encodeStateVector(host)
    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    const restore = frame(3, host, since)
    follower.applyRemoteUpdate(restore.update)
    projection.applyFrame(restore)

    expect(projection.retryFailed(WORKFLOW_ID)).toMatchObject({
      failureCount: 0
    })
    expect(projection.hasPendingFailure(WORKFLOW_ID)).toBe(false)
    expect(applyChanges.mock.calls[3][1].nodes.get('3')).toBe('update')
  })

  it('re-derives a retained add for a node the document has dropped', () => {
    const graph = fromPartial<NonNullable<ProjectionGraph>>({})
    const applyChanges = vi
      .spyOn(LiveGraphApplier.prototype, 'applyChanges')
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 1 })
      .mockReturnValue({ createdNodeIds: [], failureCount: 0 })
    const { host, follower, projection } = setup(graph)

    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    const addition = frame(1, host)
    follower.applyRemoteUpdate(addition.update)

    expect(projection.applyFrame(addition)).toMatchObject({ failureCount: 1 })
    expect(applyChanges.mock.calls[0][1].nodes.get('3')).toBe('add')

    const since = Y.encodeStateVector(host)
    nodesMap(host).delete('3')
    const removal = frame(2, host, since)
    follower.applyRemoteUpdate(removal.update)
    projection.applyFrame(removal)

    expect(projection.retryFailed(WORKFLOW_ID)).toMatchObject({
      failureCount: 0
    })
    expect(applyChanges.mock.calls[2][1].nodes.get('3')).toBe('delete')
  })

  it('keeps a later failed frame retained when an earlier one retries cleanly', () => {
    const graph = fromPartial<NonNullable<ProjectionGraph>>({})
    vi.spyOn(LiveGraphApplier.prototype, 'applyChanges')
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 1 })
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 1 })
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 0 })
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 1 })
    const { host, follower, projection } = setup(graph)

    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    const first = frame(1, host)
    follower.applyRemoteUpdate(first.update)
    projection.applyFrame(first)

    const since = Y.encodeStateVector(host)
    nodesMap(host).set('4', new Y.Map([['type', 'Note']]))
    const second = frame(2, host, since)
    follower.applyRemoteUpdate(second.update)
    projection.applyFrame(second)

    expect(projection.retryFailed(WORKFLOW_ID)).toMatchObject({
      failureCount: 1
    })
    expect(projection.hasPendingFailure(WORKFLOW_ID)).toBe(true)
  })
})
