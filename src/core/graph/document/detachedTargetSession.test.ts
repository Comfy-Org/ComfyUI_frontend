import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import type {
  TargetFrame,
  TargetFrameApplyPort
} from '@/core/graph/document/detachedTargetSession'
import { createDetachedTargetSession } from '@/core/graph/document/detachedTargetSession'

const WORKFLOW_ID = 'wf-detached'

/**
 * A host document emitting ordered incremental update frames, mirroring the
 * doc_update stream a live host produces.
 */
function createFrameSource(workflowId = WORKFLOW_ID) {
  const host = new Y.Doc()
  let seq = 0
  let lastVector = Y.encodeStateVector(host)

  function frame(
    mutate: (doc: Y.Doc) => void,
    stamps: Pick<TargetFrame, 'actor' | 'opIds'> = {}
  ): TargetFrame {
    mutate(host)
    const update = Y.encodeStateAsUpdate(host, lastVector)
    lastVector = Y.encodeStateVector(host)
    seq += 1
    return { workflowId, seq, update, ...stamps }
  }

  function diffFrom(stateVector: Uint8Array, atSeq: number): TargetFrame {
    return {
      workflowId,
      seq: atSeq,
      update: Y.encodeStateAsUpdate(host, stateVector)
    }
  }

  return { host, frame, diffFrom }
}

function setNode(doc: Y.Doc, id: string, fields: Record<string, unknown>) {
  const nodes = doc.getMap<Y.Map<unknown>>('nodes')
  const node = nodes.get(id) ?? new Y.Map<unknown>()
  if (!nodes.has(id)) nodes.set(id, node)
  for (const [key, value] of Object.entries(fields)) node.set(key, value)
}

function readNodes(update: Uint8Array): Record<string, unknown> {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, update)
  const json = doc.getMap('nodes').toJSON()
  doc.destroy()
  return json
}

const acceptAll: TargetFrameApplyPort = { apply: () => true }
const rejectAll: TargetFrameApplyPort = { apply: () => false }

describe('createDetachedTargetSession', () => {
  it('commits queued frames in order and reproduces the host state byte-exactly', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)

    session.enqueue(
      source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
    )
    session.enqueue(source.frame((doc) => setNode(doc, '1', { title: 'a' })))
    session.enqueue(source.frame((doc) => setNode(doc, '2', { type: 'Sink' })))

    const drained = session.drainAll(acceptAll)

    expect(drained).toEqual({ committed: 3, stoppedBy: { status: 'idle' } })
    expect(readNodes(session.encodeCommittedState())).toEqual(
      source.host.getMap('nodes').toJSON()
    )
    const snapshot = session.snapshot()
    expect(snapshot.committedSeq).toBe(3)
    expect(snapshot.revision).toBe(3)
    expect(snapshot.lastCommitId).toBe(`${snapshot.lineage}:3`)
    expect(snapshot.queuedFrames).toBe(0)
    expect(snapshot.needsResync).toBe(false)
  })

  it('offers the projection port the frame stamps verbatim and the staged doc with the frame folded in', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)
    const seen: { frame: TargetFrame; stagedNodes: Record<string, unknown> }[] =
      []
    const port: TargetFrameApplyPort = {
      apply: (frame, stagedDoc) => {
        seen.push({ frame, stagedNodes: stagedDoc.getMap('nodes').toJSON() })
        return true
      }
    }

    const frame = source.frame((doc) => setNode(doc, '1', { type: 'Source' }), {
      actor: 'agent:planner',
      opIds: ['op-1', 'op-2']
    })
    session.enqueue(frame)
    session.commitNext(port)

    expect(seen).toHaveLength(1)
    expect(seen[0]!.frame.actor).toBe('agent:planner')
    expect(seen[0]!.frame.opIds).toEqual(['op-1', 'op-2'])
    expect(seen[0]!.frame.seq).toBe(1)
    expect(seen[0]!.stagedNodes).toEqual({ '1': { type: 'Source' } })
  })

  it('preserves node incarnation bytes through the staged commit path', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)
    session.enqueue(
      source.frame((doc) =>
        setNode(doc, '9', { type: 'Source', __incarnation: 'inc-original-9' })
      )
    )

    session.commitNext(acceptAll)

    const committed = readNodes(session.encodeCommittedState())
    expect(committed).toEqual({
      '9': { type: 'Source', __incarnation: 'inc-original-9' }
    })
    expect(committed).toEqual(source.host.getMap('nodes').toJSON())
  })

  it('a rejected apply leaves the frame queued and the committed tuple unchanged', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)
    session.enqueue(
      source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
    )
    session.commitNext(acceptAll)
    const before = session.snapshot()
    const vectorBefore = session.recoveryStateVector()

    session.enqueue(source.frame((doc) => setNode(doc, '1', { title: 'b' })))
    const failed = session.commitNext(rejectAll)

    expect(failed).toEqual({ status: 'failed', seq: 2 })
    expect(session.snapshot()).toEqual({ ...before, queuedFrames: 1 })
    expect(session.recoveryStateVector()).toEqual(vectorBefore)

    const retried = session.commitNext(acceptAll)
    expect(retried).toEqual({
      status: 'committed',
      commitId: `${before.lineage}:2`,
      seq: 2
    })
  })

  it('a throwing apply reports failed with the error and keeps the frame queued', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)
    session.enqueue(
      source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
    )
    const boom = new Error('projection exploded')

    const result = session.commitNext({
      apply: () => {
        throw boom
      }
    })

    expect(result).toEqual({ status: 'failed', seq: 1, error: boom })
    expect(session.snapshot().queuedFrames).toBe(1)
    expect(session.snapshot().committedSeq).toBeNull()
  })

  it('a frame with malformed update bytes reports failed instead of throwing', () => {
    const session = createDetachedTargetSession(WORKFLOW_ID)
    session.enqueue({
      workflowId: WORKFLOW_ID,
      seq: 1,
      update: new Uint8Array([0xff, 0x00, 0x13, 0x37])
    })

    const result = session.commitNext(acceptAll)

    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.seq).toBe(1)
      expect(result.error).toBeDefined()
    }
    expect(session.snapshot().queuedFrames).toBe(1)
    expect(session.snapshot().committedSeq).toBeNull()
  })

  it('cannot enqueue or commit after destruction', () => {
    const session = createDetachedTargetSession(WORKFLOW_ID)
    const source = createFrameSource()
    session.destroy()

    expect(
      session.enqueue(
        source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
      )
    ).toEqual({ status: 'resync-required' })
    expect(session.commitNext(acceptAll)).toEqual({ status: 'idle' })
  })

  it('skips duplicate frames at or below the last accepted sequence', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)
    const first = source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
    session.enqueue(first)
    session.commitNext(acceptAll)

    expect(session.enqueue(first)).toEqual({ status: 'duplicate', seq: 1 })

    const second = source.frame((doc) => setNode(doc, '1', { title: 'c' }))
    session.enqueue(second)
    expect(session.enqueue(second)).toEqual({ status: 'duplicate', seq: 2 })
    expect(session.snapshot().queuedFrames).toBe(1)
  })

  it('a sequence gap discards the queue, demands resync, and preserves the recovery state vector', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)
    session.enqueue(
      source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
    )
    session.commitNext(acceptAll)
    const recoveryBefore = session.recoveryStateVector()
    session.enqueue(source.frame((doc) => setNode(doc, '1', { title: 'q' })))

    source.frame((doc) => setNode(doc, '1', { title: 'lost' }))
    const gapFrame = source.frame((doc) => setNode(doc, '2', { type: 'Sink' }))
    const result = session.enqueue(gapFrame)

    expect(result).toEqual({ status: 'gap', expectedSeq: 3, receivedSeq: 4 })
    const snapshot = session.snapshot()
    expect(snapshot.needsResync).toBe(true)
    expect(snapshot.queuedFrames).toBe(0)
    expect(snapshot.committedSeq).toBe(1)
    expect(session.recoveryStateVector()).toEqual(recoveryBefore)
    expect(session.enqueue(gapFrame)).toEqual({ status: 'resync-required' })
    expect(session.commitNext(acceptAll)).toEqual({
      status: 'resync-required'
    })
  })

  it('recovers from a gap by replaying the diff against the last committed state vector', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)
    session.enqueue(
      source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
    )
    session.commitNext(acceptAll)

    source.frame((doc) => setNode(doc, '1', { title: 'lost' }))
    session.enqueue(source.frame((doc) => setNode(doc, '2', { type: 'Sink' })))

    session.beginResync()
    const catchUp = source.diffFrom(session.recoveryStateVector(), 3)
    expect(session.enqueue(catchUp)).toEqual({
      status: 'queued',
      queuedFrames: 1
    })
    expect(session.commitNext(acceptAll).status).toBe('committed')
    expect(readNodes(session.encodeCommittedState())).toEqual(
      source.host.getMap('nodes').toJSON()
    )
  })

  it('overflow discards queued frames but keeps the last committed state for recovery', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID, {
      maxQueuedFrames: 2
    })
    session.enqueue(
      source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
    )
    session.commitNext(acceptAll)
    const recoveryBefore = session.recoveryStateVector()

    session.enqueue(source.frame((doc) => setNode(doc, '1', { title: 'a' })))
    session.enqueue(source.frame((doc) => setNode(doc, '1', { title: 'b' })))
    const overflowed = session.enqueue(
      source.frame((doc) => setNode(doc, '1', { title: 'c' }))
    )

    expect(overflowed).toEqual({ status: 'overflow', discardedFrames: 2 })
    const snapshot = session.snapshot()
    expect(snapshot.needsResync).toBe(true)
    expect(snapshot.queuedFrames).toBe(0)
    expect(snapshot.committedSeq).toBe(1)
    expect(session.recoveryStateVector()).toEqual(recoveryBefore)

    session.beginResync()
    session.enqueue(source.diffFrom(session.recoveryStateVector(), 4))
    session.commitNext(acceptAll)
    expect(readNodes(session.encodeCommittedState())).toEqual(
      source.host.getMap('nodes').toJSON()
    )
  })

  it('doc_reset starts a fresh document and lineage and invalidates old commit ids', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)
    session.enqueue(
      source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
    )
    session.commitNext(acceptAll)
    const oldSnapshot = session.snapshot()
    const oldCommitId = oldSnapshot.lastCommitId!
    expect(session.isCommitted(oldCommitId)).toBe(true)
    session.enqueue(
      source.frame((doc) => setNode(doc, '1', { title: 'stale' }))
    )

    session.resetLineage(10)

    const snapshot = session.snapshot()
    expect(snapshot.lineage).not.toBe(oldSnapshot.lineage)
    expect(snapshot.committedSeq).toBe(10)
    expect(snapshot.queuedFrames).toBe(0)
    expect(snapshot.lastCommitId).toBeNull()
    expect(session.isCommitted(oldCommitId)).toBe(false)
    expect(readNodes(session.encodeCommittedState())).toEqual({})

    const freshHost = new Y.Doc()
    setNode(freshHost, '5', { type: 'Fresh' })
    session.enqueue({
      workflowId: WORKFLOW_ID,
      seq: 11,
      update: Y.encodeStateAsUpdate(freshHost)
    })
    expect(session.commitNext(acceptAll).status).toBe('committed')
    expect(session.snapshot().lastCommitId).toBe(`${snapshot.lineage}:11`)
    freshHost.destroy()
  })

  it('rejects inherited sequences in isCommitted after a lineage reset', () => {
    const session = createDetachedTargetSession(WORKFLOW_ID)

    session.resetLineage(10)
    const { lineage } = session.snapshot()

    // Seqs at or below the reset floor were never committed in this lineage.
    expect(session.isCommitted(`${lineage}:10`)).toBe(false)
    expect(session.isCommitted(`${lineage}:5`)).toBe(false)

    const freshHost = new Y.Doc()
    setNode(freshHost, '7', { type: 'Fresh' })
    session.enqueue({
      workflowId: WORKFLOW_ID,
      seq: 11,
      update: Y.encodeStateAsUpdate(freshHost)
    })
    expect(session.commitNext(acceptAll).status).toBe('committed')

    expect(session.isCommitted(`${lineage}:11`)).toBe(true)
    expect(session.isCommitted(`${lineage}:10`)).toBe(false)
    freshHost.destroy()
  })

  it('detects a lost-in-transit frame after a lineage reset as a gap', () => {
    const session = createDetachedTargetSession(WORKFLOW_ID)
    session.resetLineage(10)

    // The new lineage continues at seq 11; seq 12 means a frame was lost.
    const freshHost = new Y.Doc()
    setNode(freshHost, '9', { type: 'Fresh' })
    const outcome = session.enqueue({
      workflowId: WORKFLOW_ID,
      seq: 12,
      update: Y.encodeStateAsUpdate(freshHost)
    })
    freshHost.destroy()

    expect(outcome).toEqual({ status: 'gap', expectedSeq: 11, receivedSeq: 12 })
    expect(session.snapshot().needsResync).toBe(true)
  })

  it('rejects frames addressed to another target loudly', () => {
    const session = createDetachedTargetSession(WORKFLOW_ID)
    const stranger = createFrameSource('wf-other')

    expect(() =>
      session.enqueue(
        stranger.frame((doc) => setNode(doc, '1', { type: 'Source' }))
      )
    ).toThrow(/frames must never cross targets/)
  })

  it('isCommitted answers for any sequence at or below the committed head of the same lineage', () => {
    const source = createFrameSource()
    const session = createDetachedTargetSession(WORKFLOW_ID)
    session.enqueue(
      source.frame((doc) => setNode(doc, '1', { type: 'Source' }))
    )
    session.enqueue(source.frame((doc) => setNode(doc, '1', { title: 'a' })))
    session.drainAll(acceptAll)
    const { lineage } = session.snapshot()

    expect(session.isCommitted(`${lineage}:1`)).toBe(true)
    expect(session.isCommitted(`${lineage}:2`)).toBe(true)
    expect(session.isCommitted(`${lineage}:3`)).toBe(false)
    expect(session.isCommitted(`other-lineage:1`)).toBe(false)
    expect(session.isCommitted('malformed')).toBe(false)
  })
})
