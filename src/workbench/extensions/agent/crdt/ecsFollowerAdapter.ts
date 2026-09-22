import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type {
  GraphMutationBatch,
  GraphMutations,
  SemanticLinkPayload,
  SemanticNodePayload
} from './graphMutations'
import { isIncompatibleLinkType } from './graphMutations'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'

import { readSubgraphDefinitions } from './agentSubgraphDefinitions'
import { indexSubgraphDefinitions } from './agentSubgraphHostSlots'
import type { SubgraphDefinitionIndex } from './agentSubgraphHostSlots'
import type { DocUpdate } from './docFrameClient'
import {
  excludeIncompatibleLinks,
  plain,
  readSemanticLink,
  readSemanticNode,
  reportOnce
} from './ecsSemanticReaders'
import { applyFullReconcile, NO_LOCAL_INTENT } from './ecsFullReconcile'
import type {
  FullReconcileContext,
  LocalIntent,
  UpsertNode
} from './ecsFullReconcile'
import type { FollowerDoc } from './followerDoc'

type NodeRootAction = 'add' | 'update' | 'delete'

/**
 * Node-map keys whose by-key edits trigger a field resync. Structural keys
 * (`inputs`, `outputs`, `pos`, `size`, widget storage) are excluded: slots
 * are handled by link events and autogrow, layout is not resynced in place.
 */
const RESYNCED_NODE_FIELDS: ReadonlySet<string> = new Set([
  'title',
  'mode',
  'flags',
  'properties',
  'color',
  'bgcolor',
  'boxcolor',
  'shape',
  'resizable',
  'showAdvanced'
])
export type MutationsForTarget =
  | GraphMutations
  | ((workflowId: string) => GraphMutations)

function readDefinitions(doc: Y.Doc): SubgraphDefinitionIndex {
  return indexSubgraphDefinitions(readSubgraphDefinitions(doc))
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

interface TargetSession<TUpdate extends DocUpdate = DocUpdate> {
  readonly workflowId: string
  readonly follower: FollowerDoc
  readonly nodes: Y.Map<Y.Map<unknown>>
  readonly links: Y.Map<unknown>
  readonly mutations: GraphMutations
  readonly nodeActions: Map<string, NodeRootAction>
  readonly changedWidgets: Map<string, Set<string>>
  readonly replacedWidgetMaps: Set<string>
  readonly replacedOpaqueWidgets: Set<string>
  readonly changedNodeFields: Set<string>
  readonly changedLinks: Set<string>
  /** Drift keys already surfaced via `reportError` for this session. */
  readonly reportedErrors: Set<string>
  readonly frameQueue: TUpdate[]
  pendingProjection: TUpdate | null
  onNodesChanged: (events: Y.YEvent<Y.AbstractType<unknown>>[]) => void
  onLinksChanged: (event: Y.YMapEvent<unknown>) => void
  reconcileNextFrame: boolean
  applying: boolean
}

interface FrameApplyContext {
  readonly session: TargetSession
  readonly batch: GraphMutationBatch
  readonly doc: Y.Doc
  readonly definitions: () => SubgraphDefinitionIndex
  readonly upsertNode: UpsertNode
}

/**
 * Projects each subscribed semantic document into its own ECS mutation stream.
 * Target sessions own their Yjs observers, pending effects, and apply queue;
 * one workflow can therefore never consume or overwrite another workflow's
 * follower state.
 */
export class EcsFollowerAdapter<TUpdate extends DocUpdate = DocUpdate> {
  private readonly targets = new Map<string, TargetSession<TUpdate>>()

  constructor(
    private readonly mutations: MutationsForTarget,
    /** ADR-CRDT-RECONCILE-0035 (c); see {@link AgentCrdtProjection}. */
    private readonly pendingAddType: (
      nodeId: string
    ) => string | undefined = () => undefined,
    private readonly intent: LocalIntent = NO_LOCAL_INTENT
  ) {}

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

  /**
   * Queue and drain only the target addressed by this frame. `EcsFollowerAdapter`
   * is generic over the caller's update shape (e.g. `ClassifiedDocUpdate`) so
   * a subtype fed in here comes back out of {@link retryPending} as that same
   * subtype, with no assertion needed at either end to recover it.
   */
  applyFrame(update: TUpdate): boolean {
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
        session.pendingProjection = committed ? null : frame
        if (frame === update) updateCommitted = committed
      }
    } finally {
      session.applying = false
    }
    return updateCommitted
  }

  retryPending(workflowId: string): TUpdate | null {
    const session = this.targets.get(workflowId)
    const update = session?.pendingProjection
    if (!session || !update || session.applying) return null

    session.applying = true
    try {
      if (!this.applyQueuedFrame(session, update)) return null
      session.pendingProjection = null
      return update
    } finally {
      session.applying = false
    }
  }

  /**
   * Runs a full reconcile against the doc for `workflowId` outside the frame
   * pipeline — the same `applyFullReconcile` batch a session's first frame
   * takes after (re)bind (`createSession`'s `reconcileNextFrame: true`). See
   * `AgentCrdtProjection.reconcileFromDoc` for why this runs outside a frame.
   */
  reconcileFromDoc(workflowId: string, seq: number): boolean {
    const session = this.targets.get(workflowId)
    if (!session || session.applying) return false
    session.applying = true
    try {
      this.discardSessionPending(session)
      const doc = session.follower.doc
      let definitionIndex: SubgraphDefinitionIndex | undefined
      const definitions = () => (definitionIndex ??= readDefinitions(doc))
      const context: RemoteMutationContext = {
        source: 'agent-remote',
        actor: 'agent-catchup',
        opId: `already-current:${seq}`
      }
      const committed = session.mutations.batch(context, (batch) => {
        const { ctx } = this.buildFrameApplyContext(
          session,
          doc,
          definitions,
          batch
        )
        applyFullReconcile(
          this.fullReconcileContext(
            session,
            doc,
            definitions,
            batch,
            ctx.upsertNode
          )
        )
      })
      session.reconcileNextFrame = !committed
      return committed
    } finally {
      session.applying = false
    }
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
  ): TargetSession<TUpdate> {
    const session: TargetSession<TUpdate> = {
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
      replacedOpaqueWidgets: new Set<string>(),
      changedNodeFields: new Set<string>(),
      changedLinks: new Set<string>(),
      reportedErrors: new Set<string>(),
      frameQueue: [],
      pendingProjection: null,
      reconcileNextFrame: true,
      applying: false,
      onNodesChanged: (_events): void => undefined,
      onLinksChanged: (_event): void => undefined
    }

    session.onNodesChanged = (events) => this.onNodesChanged(session, events)
    session.onLinksChanged = (event) => this.onLinksChanged(session, event)
    return session
  }

  /**
   * A SubgraphNode host that is already live must never be rebuilt from its
   * doc entry: `reconcileNode` (and delete + `addNode`) replaces the host's
   * input list in place, which drops the `widgetId` / `_subgraphSlot`
   * bindings its promoted widgets hang off, leaving the host with no widgets
   * at all. Resync the host's scalar fields (title, mode, flags, properties,
   * colors) and promoted values only; `readSemanticNode` has already keyed
   * the values from the definition. Shared by the queued-frame pipeline and
   * {@link reconcileFromDoc}, which runs the same reconcile outside it.
   */
  private buildFrameApplyContext(
    session: TargetSession<TUpdate>,
    doc: Y.Doc,
    definitions: () => SubgraphDefinitionIndex,
    batch: GraphMutationBatch
  ): {
    ctx: FrameApplyContext
    isHost: (payload: SemanticNodePayload) => boolean
  } {
    const isHost = (payload: SemanticNodePayload) =>
      definitions().has(payload.type)
    const upsertNode: UpsertNode = (payload, mode) => {
      if (mode === 'add') batch.addNode(payload)
      else if (isHost(payload)) batch.reconcileNodeFields(payload)
      else batch.reconcileNode(payload)
    }
    return { ctx: { session, batch, doc, definitions, upsertNode }, isHost }
  }

  private applyQueuedFrame(
    session: TargetSession<TUpdate>,
    update: DocUpdate
  ): boolean {
    const nodeActions = new Map(session.nodeActions)
    const changedWidgets = new Map(
      [...session.changedWidgets].map(([id, names]) => [id, new Set(names)])
    )
    const replacedWidgetMaps = new Set(session.replacedWidgetMaps)
    const replacedOpaqueWidgets = new Set(session.replacedOpaqueWidgets)
    const changedNodeFields = new Set(session.changedNodeFields)
    const changedLinkIds = new Set(session.changedLinks)
    const reconcile = session.reconcileNextFrame
    this.discardSessionPending(session)

    const doc = session.follower.doc
    // Most frames touch no links or hosts; index the definitions only when a
    // reader first needs them.
    let definitionIndex: SubgraphDefinitionIndex | undefined
    const definitions = () => (definitionIndex ??= readDefinitions(doc))

    const replacedNodeIds = new Set(
      [...nodeActions]
        .filter(([, action]) => action === 'update')
        .map(([id]) => id)
    )
    if (replacedNodeIds.size > 0) {
      session.links.forEach((_raw, id) => {
        const link = readSemanticLink(
          doc,
          id,
          definitions(),
          session.reportedErrors
        )
        if (
          link &&
          (replacedNodeIds.has(String(link.originNodeId)) ||
            replacedNodeIds.has(String(link.targetNodeId)))
        ) {
          changedLinkIds.add(id)
        }
      })
    }

    // A changed link the follower cannot read (gone from the doc, or re-minted
    // by cmp onto a promoted slot the definition does not declare) must be
    // retired live; otherwise its previous topology stays connected.
    const changedLinks = new Map(
      [...changedLinkIds].map((id) => [
        id,
        session.links.has(id)
          ? readSemanticLink(doc, id, definitions(), session.reportedErrors)
          : null
      ])
    )
    const removedLinkIds = [...changedLinks].flatMap(([id, link]) =>
      link && !isIncompatibleLinkType(link) ? [] : [Number(id)]
    )
    const committed = session.mutations.batch(frameContext(update), (batch) => {
      const { ctx, isHost } = this.buildFrameApplyContext(
        session,
        doc,
        definitions,
        batch
      )

      if (reconcile) {
        applyFullReconcile(
          this.fullReconcileContext(
            session,
            doc,
            definitions,
            batch,
            ctx.upsertNode
          )
        )
        return
      }

      this.applyIncrementalUpdate(
        ctx,
        isHost,
        removedLinkIds,
        nodeActions,
        replacedWidgetMaps,
        replacedOpaqueWidgets,
        changedNodeFields,
        changedWidgets,
        changedLinks
      )
    })

    // The pending sets were snapshotted and cleared before `batch` ran, so a
    // rejected batch (no scope, or validation failure) has already lost the
    // incremental record of this frame. Arm a full reconcile for the next
    // frame so the dropped edits are re-read from the doc instead of falling
    // through to incremental handling that never revisits them.
    session.reconcileNextFrame = !committed
    return committed
  }

  /** Builds the explicit dependency object {@link applyFullReconcile} takes, from this session's state and the adapter's own local-intent seam. */
  private fullReconcileContext(
    session: TargetSession<TUpdate>,
    doc: Y.Doc,
    definitions: () => SubgraphDefinitionIndex,
    batch: GraphMutationBatch,
    upsertNode: UpsertNode
  ): FullReconcileContext {
    return {
      workflowId: session.workflowId,
      nodes: session.nodes,
      links: session.links,
      reportedErrors: session.reportedErrors,
      doc,
      definitions,
      upsertNode,
      batch,
      intent: this.intent
    }
  }

  private applyIncrementalUpdate(
    ctx: FrameApplyContext,
    isHost: (payload: SemanticNodePayload) => boolean,
    removedLinkIds: readonly number[],
    nodeActions: ReadonlyMap<string, NodeRootAction>,
    replacedWidgetMaps: ReadonlySet<string>,
    replacedOpaqueWidgets: ReadonlySet<string>,
    changedNodeFields: ReadonlySet<string>,
    changedWidgets: ReadonlyMap<string, Set<string>>,
    changedLinks: ReadonlyMap<string, SemanticLinkPayload | null>
  ): void {
    ctx.batch.removeLinks(removedLinkIds)
    const payloads = this.applyNodeRootActions(ctx, isHost, nodeActions)
    this.upsertActionedPayloads(ctx, nodeActions, payloads)
    this.resyncReplacedWidgetStorage(
      ctx,
      nodeActions,
      replacedWidgetMaps,
      replacedOpaqueWidgets
    )
    this.resyncChangedNodeFields(
      ctx,
      nodeActions,
      replacedWidgetMaps,
      replacedOpaqueWidgets,
      changedNodeFields
    )
    this.resyncChangedWidgetValues(
      ctx,
      nodeActions,
      replacedWidgetMaps,
      changedWidgets
    )
    this.connectChangedLinks(
      ctx.batch,
      changedLinks,
      ctx.session.reportedErrors
    )
  }

  /** Deletes/replaces nodes per their root action; returns the surviving payloads. */
  private applyNodeRootActions(
    ctx: FrameApplyContext,
    isHost: (payload: SemanticNodePayload) => boolean,
    nodeActions: ReadonlyMap<string, NodeRootAction>
  ): Map<string, SemanticNodePayload | null> {
    const { session, batch, doc, definitions } = ctx
    const payloads = new Map(
      [...nodeActions]
        .filter(([, action]) => action !== 'delete')
        .map(
          ([id]) =>
            [
              id,
              readSemanticNode(doc, id, definitions, session.reportedErrors)
            ] as const
        )
    )
    for (const [id, action] of nodeActions) {
      if (action === 'delete') {
        batch.deleteNode(toNodeId(id))
        continue
      }
      const payload = payloads.get(id)
      if (action === 'update' && !(payload && isHost(payload)))
        batch.deleteNode(toNodeId(id))
    }
    return payloads
  }

  private upsertActionedPayloads(
    ctx: FrameApplyContext,
    nodeActions: ReadonlyMap<string, NodeRootAction>,
    payloads: ReadonlyMap<string, SemanticNodePayload | null>
  ): void {
    for (const [id, payload] of payloads) {
      if (!payload) continue
      if (nodeActions.get(id) !== 'add') {
        ctx.upsertNode(payload, 'reconcile')
        continue
      }
      this.applyAddedNode(ctx, id, payload)
    }
  }

  /**
   * A node whose widget storage was replaced wholesale, either the named
   * `widgets` map or the positional `__widgets_opaque` array (cmp writes both
   * in one transaction when a host's storage flips to opaque, and deletes the
   * opaque array when it flips back), is re-read in full.
   */
  private resyncReplacedWidgetStorage(
    ctx: FrameApplyContext,
    nodeActions: ReadonlyMap<string, NodeRootAction>,
    replacedWidgetMaps: ReadonlySet<string>,
    replacedOpaqueWidgets: ReadonlySet<string>
  ): void {
    const { session, doc, definitions, upsertNode } = ctx
    for (const id of new Set([
      ...replacedWidgetMaps,
      ...replacedOpaqueWidgets
    ])) {
      if (nodeActions.has(id)) continue
      const payload = readSemanticNode(
        doc,
        id,
        definitions,
        session.reportedErrors
      )
      if (payload) upsertNode(payload, 'reconcile')
    }
  }

  /**
   * A node whose scalar fields were edited by key (title, mode, flags,
   * properties, colors) is re-read so a live host resyncs those fields
   * without rebuilding its promoted widgets or slots.
   */
  private resyncChangedNodeFields(
    ctx: FrameApplyContext,
    nodeActions: ReadonlyMap<string, NodeRootAction>,
    replacedWidgetMaps: ReadonlySet<string>,
    replacedOpaqueWidgets: ReadonlySet<string>,
    changedNodeFields: ReadonlySet<string>
  ): void {
    const { session, doc, definitions, upsertNode } = ctx
    for (const id of changedNodeFields) {
      if (
        nodeActions.has(id) ||
        replacedWidgetMaps.has(id) ||
        replacedOpaqueWidgets.has(id)
      )
        continue
      const payload = readSemanticNode(
        doc,
        id,
        definitions,
        session.reportedErrors
      )
      if (payload) upsertNode(payload, 'reconcile')
    }
  }

  private resyncChangedWidgetValues(
    ctx: FrameApplyContext,
    nodeActions: ReadonlyMap<string, NodeRootAction>,
    replacedWidgetMaps: ReadonlySet<string>,
    changedWidgets: ReadonlyMap<string, Set<string>>
  ): void {
    const { session, batch, doc, definitions, upsertNode } = ctx
    for (const [id, names] of changedWidgets) {
      if (nodeActions.has(id) || replacedWidgetMaps.has(id)) continue
      const node = session.nodes.get(id)
      const widgets = node?.get('widgets')
      if (!(widgets instanceof Y.Map)) continue
      if ([...names].some((name) => !widgets.has(name))) {
        const payload = readSemanticNode(
          doc,
          id,
          definitions,
          session.reportedErrors
        )
        if (payload) upsertNode(payload, 'reconcile')
        continue
      }
      for (const name of names) {
        batch.setWidget(toNodeId(id), name, plain(widgets.get(name)))
      }
    }
  }

  private connectChangedLinks(
    batch: GraphMutationBatch,
    changedLinks: ReadonlyMap<string, SemanticLinkPayload | null>,
    reportedErrors: Set<string>
  ): void {
    const incomingLinks = excludeIncompatibleLinks(
      [...changedLinks.values()].filter(
        (link): link is SemanticLinkPayload => link !== null
      ),
      reportedErrors
    )
    for (const link of incomingLinks) batch.connect(link)
  }

  /**
   * ADR-CRDT-RECONCILE-0035 (c): reports (never blocks) when a doc node's id
   * is already registered locally under a DIFFERENT type than
   * {@link pendingAddType} can attribute to the page's own accepted add —
   * shared by the incremental `add` action ({@link applyAddedNode}) and the
   * full-reconcile rebind path, so a same-id, unrelated-type collision is
   * classified identically whichever path first sees the doc's node. Either
   * way the document wins via `reconcile` (auto-upgraded to a `replaceNode`
   * by `prepare()` when the types differ); only the collision case is
   * reported.
   */
  private reportNodeCollisionIfAny(
    session: TargetSession,
    id: string | number,
    localType: string,
    docType: string
  ): void {
    if (this.pendingAddType(String(id)) === docType) return
    reportOnce(
      session.reportedErrors,
      `collision:${id}`,
      new Error(
        `Node id ${id} is already registered locally as ${localType}, but an unrelated add_node for it arrived from the document as ${docType}`
      ),
      {
        errorType: 'agent_crdt_node_id_collision',
        context: { nodeId: id, localType, docType }
      }
    )
  }

  private applyAddedNode(
    ctx: FrameApplyContext,
    id: string,
    payload: SemanticNodePayload
  ): void {
    const { session, upsertNode } = ctx
    const localType = session.mutations.getNodeType(toNodeId(id))
    if (localType === undefined) {
      upsertNode(payload, 'add')
      return
    }
    this.reportNodeCollisionIfAny(session, id, localType, payload.type)
    upsertNode(payload, 'reconcile')
  }

  private discardSessionPending(session: TargetSession): void {
    session.nodeActions.clear()
    session.changedWidgets.clear()
    session.replacedWidgetMaps.clear()
    session.replacedOpaqueWidgets.clear()
    session.changedNodeFields.clear()
    session.changedLinks.clear()
  }

  private onNodesChanged(
    session: TargetSession,
    events: Y.YEvent<Y.AbstractType<unknown>>[]
  ): void {
    for (const event of events) {
      if (event instanceof Y.YArrayEvent) {
        // cmp writes `__widgets_opaque` as a plain array, but `plain()` also
        // accepts a shared Y.Array. In-place edits to that array arrive as
        // array events, not as a key replace on the node map.
        if (event.path.length === 2 && event.path[1] === OPAQUE_WIDGETS_KEY)
          session.replacedOpaqueWidgets.add(String(event.path[0]))
        continue
      }
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

      if (event.path.length !== 1) continue
      if (event.keysChanged.has('widgets')) session.replacedWidgetMaps.add(id)
      if (event.keysChanged.has(OPAQUE_WIDGETS_KEY))
        session.replacedOpaqueWidgets.add(id)
      for (const key of event.keysChanged) {
        if (RESYNCED_NODE_FIELDS.has(key)) {
          session.changedNodeFields.add(id)
          break
        }
      }
    }
  }

  private onLinksChanged(
    session: TargetSession,
    event: Y.YMapEvent<unknown>
  ): void {
    for (const id of event.keysChanged) session.changedLinks.add(id)
  }
}
