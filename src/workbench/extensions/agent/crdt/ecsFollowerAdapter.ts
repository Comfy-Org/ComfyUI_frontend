import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type {
  GraphMutations,
  SemanticLinkPayload,
  SemanticNodePayload
} from '@/core/graph/graphMutations'
import { reportError } from '@/platform/telemetry/reportError'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'

import type { DocUpdate } from './docFrameClient'
import type { FollowerDoc } from './followerDoc'

type NodeRootAction = 'add' | 'update' | 'delete'
export type MutationsForTarget =
  | GraphMutations
  | ((workflowId: string) => GraphMutations)

export type FrameProjectionResult =
  | { status: 'projected'; sequence: number }
  | { status: 'queued' }
  | { status: 'idle' }
  | { status: 'unbound' }
  | { status: 'retrying'; sequence: number; attempt: number }
  | {
      status: 'failed'
      sequence: number
      reason: 'rejected' | 'exception' | 'blocked'
    }

const PROJECTION_RETRY_MAX_ATTEMPTS = 3

function plain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) return value.toJSON()
  return structuredClone(value)
}

function readSemanticNode(doc: Y.Doc, id: string): SemanticNodePayload | null {
  const source = nodesMap(doc).get(id)
  if (!(source instanceof Y.Map)) return null
  const type = source.get('type')
  if (typeof type !== 'string' || type.length === 0) return null

  const payload: Record<string, unknown> = {}
  source.forEach((value, key) => {
    if (key === 'widgets' && value instanceof Y.Map) {
      payload.widgets_values = value.toJSON()
    } else if (key === OPAQUE_WIDGETS_KEY) {
      payload.widgets_values = plain(value)
    } else {
      payload[key] = plain(value)
    }
  })
  payload.id = id
  payload.type = type
  return payload as SemanticNodePayload
}

function readSemanticLink(doc: Y.Doc, id: string): SemanticLinkPayload | null {
  const raw = linksMap(doc).get(id)
  const tuple = raw instanceof Y.Array ? raw.toArray() : raw
  if (!Array.isArray(tuple) || tuple.length < 5) return null
  const linkId = Number(tuple[0] ?? id)
  const originSlot = Number(tuple[2])
  const targetSlot = Number(tuple[4])
  if (
    !Number.isInteger(linkId) ||
    tuple[1] == null ||
    tuple[3] == null ||
    !Number.isInteger(originSlot) ||
    !Number.isInteger(targetSlot)
  ) {
    return null
  }
  return {
    id: linkId,
    originNodeId: String(tuple[1]),
    originSlot,
    targetNodeId: String(tuple[3]),
    targetSlot,
    type:
      typeof tuple[5] === 'string' || typeof tuple[5] === 'number'
        ? tuple[5]
        : '*',
    originOutputs: readNodeSlots(doc, String(tuple[1]), 'outputs'),
    targetInputs: readNodeSlots(doc, String(tuple[3]), 'inputs')
  }
}

function readNodeSlots<TKey extends 'inputs' | 'outputs'>(
  doc: Y.Doc,
  id: string,
  key: TKey
): SemanticLinkPayload[TKey extends 'inputs'
  ? 'targetInputs'
  : 'originOutputs'] {
  const value = nodesMap(doc).get(id)?.get(key)
  return (
    value instanceof Y.Array ? value.toJSON() : []
  ) as SemanticLinkPayload[TKey extends 'inputs'
    ? 'targetInputs'
    : 'originOutputs']
}

function frameContext(update: DocUpdate): RemoteMutationContext {
  const opIds = update.opIds?.filter((id) => id.length > 0)
  return {
    source: 'agent-remote',
    actor: update.actor ?? 'agent-replay',
    opId: opIds?.at(-1) ?? 'replay',
    ...(opIds && opIds.length > 0 && { opIds })
  }
}

interface TargetSession {
  readonly workflowId: string
  readonly follower: FollowerDoc
  readonly nodes: Y.Map<Y.Map<unknown>>
  readonly links: Y.Map<unknown>
  readonly mutations: GraphMutations
  readonly nodeActions: Map<string, NodeRootAction>
  readonly changedWidgets: Map<string, Set<string>>
  readonly replacedWidgetMaps: Set<string>
  readonly changedLinks: Set<string>
  readonly frameQueue: PendingProjection[]
  onNodesChanged: (events: Y.YEvent<Y.AbstractType<unknown>>[]) => void
  onLinksChanged: (event: Y.YMapEvent<unknown>) => void
  reconcileNextFrame: boolean
  applying: boolean
  projectionBlocked: boolean
}

interface PendingProjection {
  readonly update: DocUpdate
  readonly nodeActions: Map<string, NodeRootAction>
  readonly changedWidgets: Map<string, Set<string>>
  readonly replacedWidgetMaps: Set<string>
  readonly changedLinks: Set<string>
  readonly reconcile: boolean
  attempts: number
}

/**
 * Projects each subscribed semantic document into its own ECS mutation stream.
 * Target sessions own their Yjs observers, pending effects, and apply queue;
 * one workflow can therefore never consume or overwrite another workflow's
 * follower state.
 */
export class EcsFollowerAdapter {
  private readonly targets = new Map<string, TargetSession>()

  constructor(private readonly mutations: MutationsForTarget) {}

  bind(workflowId: string, follower: FollowerDoc): void {
    this.unbind(workflowId)
    const session = this.createSession(workflowId, follower)
    this.targets.set(workflowId, session)
    session.nodes.observeDeep(session.onNodesChanged)
    session.links.observe(session.onLinksChanged)
  }

  unbind(workflowId: string): void {
    const session = this.targets.get(workflowId)
    if (!session) return
    session.nodes.unobserveDeep(session.onNodesChanged)
    session.links.unobserve(session.onLinksChanged)
    this.targets.delete(workflowId)
  }

  /** Queue and drain only the target addressed by this frame. */
  applyFrame(update: DocUpdate): FrameProjectionResult {
    const session = this.targets.get(update.workflowId)
    if (!session) return { status: 'unbound' }
    if (session.projectionBlocked)
      return { status: 'failed', sequence: update.seq, reason: 'blocked' }

    session.frameQueue.push(this.captureSessionPending(session, update))
    if (session.applying) return { status: 'queued' }
    return this.drainSession(session)
  }

  retryPending(workflowId: string): FrameProjectionResult {
    const session = this.targets.get(workflowId)
    if (!session) return { status: 'unbound' }
    if (session.projectionBlocked) {
      const sequence = session.frameQueue[0]?.update.seq ?? 0
      return { status: 'failed', sequence, reason: 'blocked' }
    }
    if (session.frameQueue.length === 0) return { status: 'idle' }
    if (session.applying) return { status: 'queued' }
    return this.drainSession(session)
  }

  private drainSession(session: TargetSession): FrameProjectionResult {
    session.applying = true
    let projectedSequence = session.frameQueue[0]?.update.seq ?? 0
    try {
      while (session.frameQueue.length > 0) {
        const pending = session.frameQueue.shift()
        if (!pending) continue
        const result = this.applyQueuedFrame(session, pending)
        if (result === 'rejected') {
          pending.attempts += 1
          if (pending.attempts < PROJECTION_RETRY_MAX_ATTEMPTS) {
            session.frameQueue.unshift(pending)
            return {
              status: 'retrying',
              sequence: pending.update.seq,
              attempt: pending.attempts
            }
          }
          this.blockProjection(session)
          return {
            status: 'failed',
            sequence: pending.update.seq,
            reason: 'rejected'
          }
        }
        if (result === 'exception') {
          this.blockProjection(session)
          return {
            status: 'failed',
            sequence: pending.update.seq,
            reason: 'exception'
          }
        }
        projectedSequence = pending.update.seq
      }
    } finally {
      session.applying = false
    }
    return { status: 'projected', sequence: projectedSequence }
  }

  /** Explicit lineage reset only; reconnect/gap recovery never calls it. */
  clearForReset(workflowId: string, context: RemoteMutationContext): boolean {
    const session = this.targets.get(workflowId)
    if (!session) return false
    session.projectionBlocked = false
    session.frameQueue.length = 0
    this.discardSessionPending(session)
    return session.mutations.clearSemanticGraph(context)
  }

  discardPending(workflowId: string): void {
    const session = this.targets.get(workflowId)
    if (session) this.discardSessionPending(session)
  }

  destroy(): void {
    for (const workflowId of [...this.targets.keys()]) this.unbind(workflowId)
  }

  private createSession(
    workflowId: string,
    follower: FollowerDoc
  ): TargetSession {
    const session: TargetSession = {
      workflowId,
      follower,
      nodes: nodesMap(follower.doc),
      links: linksMap(follower.doc),
      mutations:
        typeof this.mutations === 'function'
          ? this.mutations(workflowId)
          : this.mutations,
      nodeActions: new Map<string, NodeRootAction>(),
      changedWidgets: new Map<string, Set<string>>(),
      replacedWidgetMaps: new Set<string>(),
      changedLinks: new Set<string>(),
      frameQueue: [],
      reconcileNextFrame: true,
      applying: false,
      projectionBlocked: false,
      onNodesChanged: (_events): void => undefined,
      onLinksChanged: (_event): void => undefined
    }

    session.onNodesChanged = (events) => this.onNodesChanged(session, events)
    session.onLinksChanged = (event) => this.onLinksChanged(session, event)
    return session
  }

  private captureSessionPending(
    session: TargetSession,
    update: DocUpdate
  ): PendingProjection {
    const pending = {
      update,
      nodeActions: new Map(session.nodeActions),
      changedWidgets: new Map(
        [...session.changedWidgets].map(([id, names]) => [id, new Set(names)])
      ),
      replacedWidgetMaps: new Set(session.replacedWidgetMaps),
      changedLinks: new Set(session.changedLinks),
      reconcile: session.reconcileNextFrame,
      attempts: 0
    }
    session.reconcileNextFrame = false
    this.discardSessionPending(session)
    return pending
  }

  private applyQueuedFrame(
    session: TargetSession,
    pending: PendingProjection
  ): 'projected' | 'rejected' | 'exception' {
    const {
      update,
      nodeActions,
      changedWidgets,
      replacedWidgetMaps,
      reconcile
    } = pending
    const changedLinkIds = pending.changedLinks

    const replacedNodeIds = new Set(
      [...nodeActions]
        .filter(([, action]) => action === 'update')
        .map(([id]) => id)
    )
    if (replacedNodeIds.size > 0) {
      session.links.forEach((_raw, id) => {
        const link = readSemanticLink(session.follower.doc, id)
        if (
          link &&
          (replacedNodeIds.has(String(link.originNodeId)) ||
            replacedNodeIds.has(String(link.targetNodeId)))
        ) {
          changedLinkIds.add(id)
        }
      })
    }

    const removedLinkIds = [...changedLinkIds].flatMap((id) =>
      session.links.has(id) ? [] : [Number(id)]
    )
    try {
      const committed = session.mutations.batch(
        frameContext(update),
        (batch) => {
          if (reconcile) {
            const nodes = [...session.nodes.keys()].flatMap((id) => {
              const payload = readSemanticNode(session.follower.doc, id)
              return payload ? [payload] : []
            })
            const links = [...session.links.keys()].flatMap((id) => {
              const link = readSemanticLink(session.follower.doc, id)
              return link ? [link] : []
            })
            batch.removeMissing(
              nodes.map(({ id }) => toNodeId(id)),
              links.map(({ id }) => id)
            )
            for (const payload of nodes) batch.reconcileNode(payload)
            for (const link of links) batch.connect(link)
            return
          }

          batch.removeLinks(removedLinkIds)
          for (const [id, action] of nodeActions) {
            if (action === 'delete' || action === 'update')
              batch.deleteNode(toNodeId(id))
          }
          for (const [id, action] of nodeActions) {
            if (action === 'delete') continue
            const payload = readSemanticNode(session.follower.doc, id)
            if (payload) batch.addNode(payload)
          }
          for (const id of replacedWidgetMaps) {
            if (nodeActions.has(id)) continue
            const payload = readSemanticNode(session.follower.doc, id)
            if (payload) batch.reconcileNode(payload)
          }
          for (const [id, names] of changedWidgets) {
            if (nodeActions.has(id) || replacedWidgetMaps.has(id)) continue
            const node = session.nodes.get(id)
            const widgets = node?.get('widgets')
            if (!(widgets instanceof Y.Map)) continue
            if ([...names].some((name) => !widgets.has(name))) {
              const payload = readSemanticNode(session.follower.doc, id)
              if (payload) batch.reconcileNode(payload)
              continue
            }
            for (const name of names) {
              batch.setWidget(toNodeId(id), name, plain(widgets.get(name)))
            }
          }
          for (const id of changedLinkIds) {
            const link = readSemanticLink(session.follower.doc, id)
            if (link) batch.connect(link)
          }
        }
      )
      return committed ? 'projected' : 'rejected'
    } catch (error) {
      reportError(error, {
        errorType: 'agent_crdt_projection_failure'
      })
      return 'exception'
    }
  }

  private blockProjection(session: TargetSession): void {
    session.projectionBlocked = true
    session.frameQueue.length = 0
    this.discardSessionPending(session)
  }

  private discardSessionPending(session: TargetSession): void {
    session.nodeActions.clear()
    session.changedWidgets.clear()
    session.replacedWidgetMaps.clear()
    session.changedLinks.clear()
  }

  private onNodesChanged(
    session: TargetSession,
    events: Y.YEvent<Y.AbstractType<unknown>>[]
  ): void {
    for (const event of events) {
      if (!(event instanceof Y.YMapEvent)) continue
      if (event.target === session.nodes) {
        for (const [id, change] of event.changes.keys)
          session.nodeActions.set(id, change.action)
        continue
      }

      const id = String(event.path[0] ?? '')
      if (!id) continue
      if (event.path[1] === 'widgets') {
        const names = session.changedWidgets.get(id) ?? new Set<string>()
        for (const name of event.keysChanged) names.add(name)
        session.changedWidgets.set(id, names)
        continue
      }

      if (event.path.length === 1 && event.keysChanged.has('widgets'))
        session.replacedWidgetMaps.add(id)
    }
  }

  private onLinksChanged(
    session: TargetSession,
    event: Y.YMapEvent<unknown>
  ): void {
    for (const id of event.keysChanged) session.changedLinks.add(id)
  }
}
