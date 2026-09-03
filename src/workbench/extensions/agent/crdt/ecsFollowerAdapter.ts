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
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'

import type { DocUpdate } from './docFrameClient'
import type { FollowerDoc } from './followerDoc'
import { FollowerSchemaError, assertReadableSchema } from './schemaGuard'

type NodeRootAction = 'add' | 'update' | 'delete'
export type MutationsForTarget =
  | GraphMutations
  | ((workflowId: string) => GraphMutations)

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

/** Slots `prepare` will keep: it drops every non-record entry before indexing. */
function connectableSlots(slots: readonly unknown[] | undefined): number {
  return (slots ?? []).filter(
    (slot) => typeof slot === 'object' && slot !== null && !Array.isArray(slot)
  ).length
}

/**
 * The `prepare` connect rejections observable from the doc alone, mirrored
 * because it fails the whole batch on the first one. Graph ownership is not
 * among them: only the link store knows an id already belongs elsewhere.
 */
function isConnectable(
  link: SemanticLinkPayload,
  projectedIds: ReadonlySet<string>
): boolean {
  return (
    link.id >= 0 &&
    link.originSlot >= 0 &&
    link.targetSlot >= 0 &&
    projectedIds.has(String(link.originNodeId)) &&
    projectedIds.has(String(link.targetNodeId)) &&
    link.originSlot < connectableSlots(link.originOutputs) &&
    link.targetSlot < connectableSlots(link.targetInputs)
  )
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
  readonly frameQueue: DocUpdate[]
  onNodesChanged: (events: Y.YEvent<Y.AbstractType<unknown>>[]) => void
  onLinksChanged: (event: Y.YMapEvent<unknown>) => void
  reconcileNextFrame: boolean
  applying: boolean
}

/**
 * Projects each subscribed semantic document into its own ECS mutation stream.
 * Target sessions own their Yjs observers, pending effects, and apply queue;
 * one workflow can therefore never consume or overwrite another workflow's
 * follower state.
 */
export class EcsFollowerAdapter {
  private readonly targets = new Map<string, TargetSession>()
  private readonly followerWorkflowIds = new WeakMap<FollowerDoc, string>()

  constructor(private readonly mutations: MutationsForTarget) {}

  bind(workflowId: string, follower: FollowerDoc): void {
    this.unbind(workflowId)
    const session = this.createSession(workflowId, follower)
    const previousWorkflowId = this.followerWorkflowIds.get(follower)
    if (previousWorkflowId && previousWorkflowId !== workflowId) {
      session.reconcileNextFrame = false
    }
    this.followerWorkflowIds.set(follower, workflowId)
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
  applyFrame(update: DocUpdate): boolean {
    const session = this.targets.get(update.workflowId)
    if (!session) return false

    session.frameQueue.push(update)
    if (session.applying) return true
    session.applying = true
    let updateCommitted = false
    try {
      while (session.frameQueue.length > 0) {
        const frame = session.frameQueue.shift()
        if (!frame) continue
        const committed = this.applyQueuedFrame(session, frame)
        if (frame === update) updateCommitted = committed
      }
    } finally {
      session.applying = false
    }
    return updateCommitted
  }

  /**
   * Commit the bound doc's current content under its own provenance, for a doc
   * preloaded from a saved snapshot: Yjs observers only report what changes
   * after `bind`, so that content would otherwise stay unprojected until an
   * unrelated later delta arrived.
   *
   * Opt-in, never done by `bind`, because the bridge reuses one long-lived
   * follower doc across workflow switches: seeding at bind would project the
   * previous workflow's graph into this one, and re-reconcile every node on an
   * ordinary unbind/rebind of an unchanged doc.
   *
   * An unprojectable link is skipped rather than batched, since `prepare`
   * rejects a whole batch on its first invalid entry. A self-inconsistent doc
   * can therefore land a node whose slot mirror still names a skipped link,
   * leaving that slot pointing at a topology the link store does not hold.
   *
   * Additive for nodes: ECS nodes the doc does not mention are left alone, so
   * this converges the graph on the doc rather than replacing it. A caller
   * wanting a true replace must clear first, accepting two separate batches.
   *
   * Not additive for the slots of a node it reconciles: `reconcileNode` splices
   * the doc's slot records over the store's, so a store link in a slot the doc
   * omits is left registered with no slot referencing it. `applyQueuedFrame`
   * has the same hole on its own reconcile path; both need `linkStore` access
   * to close, so a caller must not restore onto a populated graph until it is.
   *
   * Returns false when nothing is bound, when the doc fails the KA-11 read gate
   * with a {@link FollowerSchemaError}, or when the batch was rejected.
   * Restores arrive out of band, so this is the only place that gate can run
   * for them.
   *
   * No production caller yet: nothing persists or restores Yjs bytes today.
   */
  projectBaseline(workflowId: string, context: RemoteMutationContext): boolean {
    const session = this.targets.get(workflowId)
    if (!session) return false
    try {
      assertReadableSchema(session.follower.doc)
    } catch (error) {
      if (!(error instanceof FollowerSchemaError)) throw error
      return false
    }

    const nodes = [...session.nodes.keys()].flatMap((id) => {
      const payload = readSemanticNode(session.follower.doc, id)
      return payload ? [payload] : []
    })
    const projectedIds = new Set(nodes.map(({ id }) => String(id)))
    const links: SemanticLinkPayload[] = []
    const skippedLinks: string[] = []
    for (const id of session.links.keys()) {
      const link = readSemanticLink(session.follower.doc, id)
      if (link && isConnectable(link, projectedIds)) links.push(link)
      else skippedLinks.push(id)
    }

    const skippedNodes = [...session.nodes.keys()].filter(
      (id) => !projectedIds.has(id)
    )
    if (skippedNodes.length > 0 || skippedLinks.length > 0) {
      console.warn(
        `[agent-crdt] baseline for ${workflowId} skipped unprojectable nodes ` +
          `[${skippedNodes.join(', ')}] and links [${skippedLinks.join(', ')}]`
      )
    }

    const projected = session.mutations.batch(context, (batch) => {
      for (const node of nodes) batch.reconcileNode(node)
      for (const link of links) batch.connect(link)
    })
    if (!projected) return false

    // Everything the doc holds, skipped included: a skipped entry left staged
    // is retried next frame, whose whole batch `prepare` then rejects. A staged
    // deletion is not in the doc, so it survives — nothing else can find it.
    for (const id of session.nodes.keys()) {
      session.nodeActions.delete(id)
      session.changedWidgets.delete(id)
    }
    for (const id of session.links.keys()) session.changedLinks.delete(id)

    // This baseline performed the initial reconciliation. Later wire deltas
    // must use the normal add/update paths so links are updated atomically.
    if (nodes.length > 0 || links.length > 0) {
      session.reconcileNextFrame = false
    }
    return true
  }

  /** Explicit lineage reset only; reconnect/gap recovery never calls it. */
  clearForReset(workflowId: string, context: RemoteMutationContext): boolean {
    const session = this.targets.get(workflowId)
    if (!session) return false
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
      onNodesChanged: (_events): void => undefined,
      onLinksChanged: (_event): void => undefined
    }

    session.onNodesChanged = (events) => this.onNodesChanged(session, events)
    session.onLinksChanged = (event) => this.onLinksChanged(session, event)
    return session
  }

  private applyQueuedFrame(session: TargetSession, update: DocUpdate): boolean {
    const nodeActions = new Map(session.nodeActions)
    const changedWidgets = new Map(
      [...session.changedWidgets].map(([id, names]) => [id, new Set(names)])
    )
    const replacedWidgetMaps = new Set(session.replacedWidgetMaps)
    const changedLinkIds = new Set(session.changedLinks)
    const reconcile = session.reconcileNextFrame
    this.discardSessionPending(session)

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
    const committed = session.mutations.batch(frameContext(update), (batch) => {
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
        if (!payload) continue
        batch.addNode(payload)
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
    })

    // Only clear the reconciliation flag once the batch actually commits.
    // A rejected batch (no scope, or validation failure) must leave
    // reconcileNextFrame set so the next frame retries authoritative
    // cleanup instead of falling through to incremental handling with
    // stale local-only graph state still present.
    if (committed) session.reconcileNextFrame = false
    return committed
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
