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
import { reportError } from '@/platform/telemetry/reportError'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { parseLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { readSubgraphDefinitions } from './agentSubgraphDefinitions'
import {
  hostInputs,
  hostSlotIndex,
  indexSubgraphDefinitions,
  promotedWidgetNames
} from './agentSubgraphHostSlots'
import type { SubgraphDefinitionIndex } from './agentSubgraphHostSlots'
import type { DocUpdate } from './docFrameClient'
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

/**
 * Live node ids (string keys) the doc has never held, plus the live link ids
 * incident to them. `null` means the caller could not determine this for the
 * frame (no live graph to consult, or the reconcile belongs to a workflow
 * this caller has not bound) -- distinct from an empty result, which means
 * the caller looked and genuinely found nothing to protect.
 */
export interface LocalOnlyGraphIds {
  nodeIds: ReadonlySet<string>
  linkIds: ReadonlySet<number>
}

/**
 * The local human's edits the host has not yet reflected in the doc. A full
 * reconcile treats the doc as authoritative for everything else; without
 * this seam it would recreate a node whose delete is still on its way.
 */
export interface LocalIntent {
  /** Doc node ids (string keys) with a pending human `delete_node`. */
  pendingDeletes(workflowId: string): ReadonlySet<string>
  /**
   * Live node/link ids the doc has never held. Consulted only for the one
   * full reconcile a session's first *completed* protected bind runs: a node
   * added by hand before the follower ever protected a reconcile has no doc
   * record and must not be swept as "missing" by that frame's
   * `removeMissing` -- nor its incident links, which `removeMissing` would
   * otherwise sweep right alongside a node it does retain.
   */
  localOnlyGraphIds(workflowId: string): LocalOnlyGraphIds | null
  /** Records doc provenance after a protected reconcile commits. */
  commitProtectedReconcile?(workflowId: string): void
}

const NO_LOCAL_INTENT: LocalIntent = {
  pendingDeletes: () => new Set(),
  localOnlyGraphIds: () => ({ nodeIds: new Set(), linkIds: new Set() })
}

function plain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) return value.toJSON()
  return structuredClone(value)
}

/**
 * Doc/live drift (an opaque widget array of the wrong length, a link onto an
 * undeclared promoted slot) persists in the doc, so every later frame that
 * re-reads the same entry would report it again. Report each distinct drift
 * once per target session; the set lives as long as the session does.
 */
function reportOnce(
  reported: Set<string>,
  key: string,
  error: Error,
  options: Parameters<typeof reportError>[1]
): void {
  if (reported.has(key)) return
  reported.add(key)
  reportError(error, options)
}

/**
 * Reads a node's doc entry as a semantic payload. A SubgraphNode host (a node
 * whose type names a definition) is stored opaquely by cmp: positional widget
 * values under `__widgets_opaque` and only the grown slots under `inputs`.
 * Both are re-keyed from the definition so `reconcileNode` registers the
 * host's widgets under their promoted names and keeps its full slot list;
 * otherwise a reconcile would wipe the promoted widgets and `setWidget` by
 * name could never find them again.
 */
function readSemanticNode(
  doc: Y.Doc,
  id: string,
  definitions: () => SubgraphDefinitionIndex,
  reported: Set<string>
): SemanticNodePayload | null {
  const source = nodesMap(doc).get(id)
  if (!(source instanceof Y.Map)) return null
  const type = source.get('type')
  if (typeof type !== 'string' || type.length === 0) return null

  const payload: SemanticNodePayload = { id, type }
  source.forEach((value, key) => {
    if (key === 'id' || key === 'type') return
    if (key === 'widgets' && value instanceof Y.Map) {
      payload.widgets_values = value.toJSON()
    } else if (key === OPAQUE_WIDGETS_KEY) {
      payload.widgets_values = plain(value)
    } else {
      payload[key] = plain(value)
    }
  })

  const definition = definitions().get(type)
  if (definition) {
    const opaque = payload.widgets_values
    if (Array.isArray(opaque)) {
      const names = promotedWidgetNames(definition, definitions())
      if (opaque.length === names.length) {
        payload.widgets_values = Object.fromEntries(
          opaque.map((value, index) => [names[index], value])
        )
      } else {
        // cmp writes the whole positional array against the same promoted
        // list (`promoted_inputs()`), so a length mismatch means the writer
        // and this reader disagree on the host surface. Mapping positionally
        // would land values on the wrong promoted widget; keep the live
        // values and surface the drift instead.
        delete payload.widgets_values
        reportOnce(
          reported,
          `widgets:${id}:${names.length}:${opaque.length}`,
          new Error(
            `Subgraph host ${id} (${type}) carries ${opaque.length} opaque widget values but its definition promotes ${names.length}`
          ),
          {
            errorType: 'error_reconciling_agent_subgraph_host_widgets',
            context: {
              nodeId: id,
              type,
              expected: names.length,
              actual: opaque.length
            }
          }
        )
      }
    }
    const docInputs = source.get('inputs')
    payload.inputs = hostInputs(
      definition,
      docInputs instanceof Y.Array ? docInputs.toJSON() : []
    )
  }
  return payload
}

/**
 * Resolves a link whose target is a SubgraphNode host. cmp only writes the
 * grown slot into the host's doc `inputs`, and its `target_slot` indexes that
 * doc-local list. The live host orders its inputs by the subgraph definition,
 * so re-derive both the slot index and the full input list from it.
 *
 * Returns `null` when the doc slot names an input the definition does not
 * declare (cmp's `claimPromotedInput` does not validate the grown name). The
 * live host has no such slot, so wiring the link positionally would land it
 * on an unrelated input; the caller skips the link instead and the drop is
 * reported so the doc/live divergence is visible.
 */
function hostTarget(
  doc: Y.Doc,
  definitions: SubgraphDefinitionIndex,
  reported: Set<string>,
  targetId: string,
  docSlot: number
): Pick<SemanticLinkPayload, 'targetSlot' | 'targetInputs'> | null {
  const docInputs = readNodeSlots(doc, targetId, 'inputs')
  const type = nodesMap(doc).get(targetId)?.get('type')
  const definition =
    typeof type === 'string' ? definitions.get(type) : undefined
  if (!definition) return { targetSlot: docSlot, targetInputs: docInputs }

  const name = docInputs?.[docSlot]?.name
  const slot = name == null ? -1 : hostSlotIndex(definition, name)
  if (slot < 0) {
    reportInvalidHostTarget(reported, targetId, type, docSlot, name)
    return null
  }
  return {
    targetSlot: slot,
    targetInputs: hostInputs(definition, docInputs ?? [])
  }
}

function reportInvalidHostTarget(
  reported: Set<string>,
  targetId: string,
  type: unknown,
  docSlot: number,
  name: string | undefined
): void {
  const displayName = name == null ? 'unnamed' : `'${name}'`
  reportOnce(
    reported,
    `slot:${targetId}:${docSlot}:${name ?? ''}`,
    new Error(
      `Subgraph host ${targetId} (${String(type)}) link targets doc slot ${docSlot} (${displayName}), which its definition does not declare unambiguously`
    ),
    {
      errorType: 'error_reconciling_agent_subgraph_host_slot',
      context: { nodeId: targetId, type, slot: docSlot, name: name ?? null }
    }
  )
}

function resolveLinkId(raw: unknown): number | null {
  return typeof raw === 'number' && raw >= 0 && Number.isSafeInteger(raw)
    ? raw
    : null
}

function resolveLinkMapKey(id: string): number | null {
  const linkId = parseLinkId(id)
  return linkId !== undefined && linkId >= 0 ? linkId : null
}

/**
 * The link ids `applyIncrementalFrame` must actively `removeLinks` for: a
 * changed link that is now missing from the doc, unreadable, or newly
 * incompatible. A link that is still present and compatible is instead
 * re-`connect`ed from `changedLinks`, never listed here.
 */
function removedLinkIdsFor(
  changedLinks: ReadonlyMap<string, SemanticLinkPayload | null>
): number[] {
  return [...changedLinks].flatMap(([id, link]) => {
    if (link && !isIncompatibleLinkType(link)) return []
    const linkId = resolveLinkMapKey(id)
    return linkId === null ? [] : [linkId]
  })
}

function readSemanticLink(
  doc: Y.Doc,
  id: string,
  definitions: SubgraphDefinitionIndex,
  reported: Set<string>
): SemanticLinkPayload | null {
  const raw = linksMap(doc).get(id)
  const tuple = raw instanceof Y.Array ? raw.toArray() : raw
  if (!Array.isArray(tuple) || tuple.length < 5) return null
  const linkId = resolveLinkId(tuple[0])
  const mapLinkId = resolveLinkMapKey(id)
  const originSlot = Number(tuple[2])
  const targetSlot = Number(tuple[4])
  if (
    linkId === null ||
    mapLinkId !== linkId ||
    tuple[1] == null ||
    tuple[3] == null ||
    !Number.isInteger(originSlot) ||
    !Number.isInteger(targetSlot)
  ) {
    return null
  }
  const targetNodeId = String(tuple[3])
  const target = hostTarget(
    doc,
    definitions,
    reported,
    targetNodeId,
    targetSlot
  )
  if (!target) return null
  return {
    id: linkId,
    originNodeId: String(tuple[1]),
    originSlot,
    targetNodeId,
    type:
      typeof tuple[5] === 'string' || typeof tuple[5] === 'number'
        ? tuple[5]
        : '*',
    originOutputs: readNodeSlots(doc, String(tuple[1]), 'outputs'),
    ...target
  }
}

function readDefinitions(doc: Y.Doc): SubgraphDefinitionIndex {
  return indexSubgraphDefinitions(readSubgraphDefinitions(doc))
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

/**
 * Drops any link whose declared origin/target types `connect` would refuse.
 * `GraphMutations.batch` validates a whole batch atomically (by design —
 * see the "validates the whole plan before committing any writes" tests in
 * graphMutations.test.ts), so replaying every retained link unconditionally
 * during reconciliation means a single incompatible link already sitting in
 * the host-owned document — written before this type check existed, or by
 * any other path that bypassed it — would fail the SAME `connect` every
 * time reconciliation re-reads it, taking every other node/link/widget
 * queued in that batch down with it. Because a failed batch also re-arms
 * `reconcileNextFrame`, the next frame replays the identical bad link and
 * fails again, forever: no later valid mutation can ever land while that
 * one link remains.
 *
 * This never rewrites the shared document to "recover" — the excluded
 * link's doc entry is untouched, so it stays there exactly as before. It
 * only keeps this follower from materializing that one link into the local
 * canvas mirror, which is enough for the rest of the batch (every other
 * retained node and link, plus any new mutation queued in the same frame)
 * to validate and commit normally.
 */
function excludeIncompatibleLinks(
  links: readonly SemanticLinkPayload[],
  reported: Set<string>
): SemanticLinkPayload[] {
  return links.filter((link) => {
    if (!isIncompatibleLinkType(link)) return true
    reportOnce(
      reported,
      `link-type:${link.id}`,
      new Error(
        `Link ${link.id} (node ${link.originNodeId} slot ${link.originSlot} -> node ${link.targetNodeId} slot ${link.targetSlot}) has an incompatible origin/target type and will not be projected`
      ),
      {
        errorType: 'error_reconciling_agent_incompatible_link_type',
        context: {
          linkId: link.id,
          originNodeId: link.originNodeId,
          originSlot: link.originSlot,
          targetNodeId: link.targetNodeId,
          targetSlot: link.targetSlot
        }
      }
    )
    return false
  })
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

/**
 * One frame's snapshotted incremental edits, read off `TargetSession`
 * before `discardSessionPending` clears it for the next frame. Passed to
 * `applyIncrementalFrame` rather than the session itself so that function
 * cannot reach past what this one frame observed.
 */
interface FramePendingEdits {
  readonly nodeActions: ReadonlyMap<string, NodeRootAction>
  readonly changedWidgets: ReadonlyMap<string, ReadonlySet<string>>
  readonly replacedWidgetMaps: ReadonlySet<string>
  readonly replacedOpaqueWidgets: ReadonlySet<string>
  readonly changedNodeFields: ReadonlySet<string>
  readonly changedLinks: ReadonlyMap<string, SemanticLinkPayload | null>
  readonly removedLinkIds: readonly number[]
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
  readonly replacedOpaqueWidgets: Set<string>
  readonly changedNodeFields: Set<string>
  readonly changedLinks: Set<string>
  /** Drift keys already surfaced via `reportError` for this session. */
  readonly reportedErrors: Set<string>
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
  private readonly protectedWorkflowIds = new Set<string>()

  constructor(
    private readonly mutations: MutationsForTarget,
    private readonly intent: LocalIntent = NO_LOCAL_INTENT
  ) {}

  private needsProtection(workflowId: string): boolean {
    return !this.protectedWorkflowIds.has(workflowId)
  }

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

  /** Explicit lineage reset only; reconnect/gap recovery never calls it. */
  clearForReset(workflowId: string, context: RemoteMutationContext): boolean {
    this.protectedWorkflowIds.delete(workflowId)
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
    for (const workflowId of Array.from(this.targets.keys()))
      this.unbind(workflowId)
    this.protectedWorkflowIds.clear()
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
      replacedOpaqueWidgets: new Set<string>(),
      changedNodeFields: new Set<string>(),
      changedLinks: new Set<string>(),
      reportedErrors: new Set<string>(),
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
    const changedLinks = this.changedLinksFor(
      session,
      doc,
      definitions,
      replacedNodeIds,
      changedLinkIds
    )
    const framePending: FramePendingEdits = {
      nodeActions,
      changedWidgets,
      replacedWidgetMaps,
      replacedOpaqueWidgets,
      changedNodeFields,
      changedLinks,
      removedLinkIds: removedLinkIdsFor(changedLinks)
    }
    const needsProtection = this.needsProtection(session.workflowId)
    const localOnly =
      reconcile && needsProtection
        ? this.intent.localOnlyGraphIds(session.workflowId)
        : null
    if (reconcile && needsProtection && localOnly === null) {
      session.reconcileNextFrame = true
      return false
    }

    const committed = session.mutations.batch(frameContext(update), (batch) =>
      reconcile
        ? this.reconcileFrame(session, batch, doc, definitions, localOnly)
        : this.applyIncrementalFrame(
            session,
            batch,
            doc,
            definitions,
            framePending
          )
    )

    if (committed && localOnly !== null) {
      this.protectedWorkflowIds.add(session.workflowId)
      this.intent.commitProtectedReconcile?.(session.workflowId)
    }
    // The pending sets were snapshotted and cleared before `batch` ran, so a
    // rejected batch (no scope, or validation failure) has already lost the
    // incremental record of this frame. Arm a full reconcile for the next
    // frame so the dropped edits are re-read from the doc instead of falling
    // through to incremental handling that never revisits them.
    session.reconcileNextFrame = !committed
    return committed
  }

  /**
   * Extends `changedLinkIds` with every link incident to a node this frame
   * replaced wholesale (a `reconcileNode`/`reconcileNodeFields` target, not a
   * `setWidget` patch) -- a doc-side replace can move slot indices without
   * the link's own doc entry changing, so a link the doc did not itself
   * touch can still need re-materializing. Resolves each changed link's
   * current doc state too, so an id gone from the live map, or pointing at a
   * slot the follower cannot read, comes back `null` rather than throwing
   * when `applyIncrementalFrame` reads it later.
   */
  private changedLinksFor(
    session: TargetSession,
    doc: Y.Doc,
    definitions: () => SubgraphDefinitionIndex,
    replacedNodeIds: ReadonlySet<string>,
    changedLinkIds: ReadonlySet<string>
  ): Map<string, SemanticLinkPayload | null> {
    const ids = new Set(changedLinkIds)
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
          ids.add(id)
        }
      })
    }
    // A changed link the follower cannot read (gone from the doc, or
    // re-minted by cmp onto a promoted slot the definition does not
    // declare) must be retired live; otherwise its previous topology stays
    // connected.
    return new Map(
      [...ids].map((id) => [
        id,
        session.links.has(id)
          ? readSemanticLink(doc, id, definitions(), session.reportedErrors)
          : null
      ])
    )
  }

  /**
   * A SubgraphNode host that is already live must never be rebuilt from its
   * doc entry: `reconcileNode` (and delete + `addNode`) replaces the host's
   * input list in place, which drops the `widgetId` / `_subgraphSlot`
   * bindings its promoted widgets hang off, leaving the host with no
   * widgets at all. Resync the host's scalar fields (title, mode, flags,
   * properties, colors) and promoted values only; `readSemanticNode` has
   * already keyed the values from the definition.
   */
  private upsertNode(
    batch: GraphMutationBatch,
    definitions: () => SubgraphDefinitionIndex,
    payload: SemanticNodePayload,
    mode: 'add' | 'reconcile'
  ): void {
    if (mode === 'add') batch.addNode(payload)
    else if (definitions().has(payload.type)) batch.reconcileNodeFields(payload)
    else batch.reconcileNode(payload)
  }

  /**
   * Full resync path for a session whose `reconcileNextFrame` is armed:
   * replaces the batch's view of every doc node/link with what the doc
   * holds right now (minus `pendingDeletes`, the local human's edits the
   * doc has not caught up to yet). `localOnly`'s ids -- live-only
   * nodes/links `removeMissing` must not sweep -- are kept out of that
   * missing calculation without themselves being upserted from the doc.
   */
  private reconcileFrame(
    session: TargetSession,
    batch: GraphMutationBatch,
    doc: Y.Doc,
    definitions: () => SubgraphDefinitionIndex,
    localOnly: LocalOnlyGraphIds | null
  ): void {
    const pendingDeletes = this.intent.pendingDeletes(session.workflowId)
    const localOnlyNodeIds = localOnly?.nodeIds ?? new Set<string>()
    const localOnlyLinkIds = localOnly?.linkIds ?? new Set<number>()
    const nodes = [...session.nodes.keys()]
      .filter((id) => !pendingDeletes.has(id))
      .flatMap((id) => {
        const payload = readSemanticNode(
          doc,
          id,
          definitions,
          session.reportedErrors
        )
        return payload ? [payload] : []
      })
    const links = excludeIncompatibleLinks(
      [...session.links.keys()].flatMap((id) => {
        const link = readSemanticLink(
          doc,
          id,
          definitions(),
          session.reportedErrors
        )
        return link &&
          !pendingDeletes.has(String(link.originNodeId)) &&
          !pendingDeletes.has(String(link.targetNodeId))
          ? [link]
          : []
      }),
      session.reportedErrors
    )
    batch.removeMissing(
      [
        ...nodes.map(({ id }) => toNodeId(id)),
        ...[...localOnlyNodeIds].map((id) => toNodeId(id))
      ],
      [...links.map(({ id }) => id), ...localOnlyLinkIds]
    )
    for (const payload of nodes)
      this.upsertNode(batch, definitions, payload, 'reconcile')
    for (const link of links) batch.connect(link)
  }

  /**
   * Incremental path for a session that already reflects the doc: replays
   * only this frame's `pending` edits (node adds/updates/deletes, widget and
   * field resyncs, link changes) instead of re-reading every node and link
   * the way `reconcileFrame` does.
   */
  private applyIncrementalFrame(
    session: TargetSession,
    batch: GraphMutationBatch,
    doc: Y.Doc,
    definitions: () => SubgraphDefinitionIndex,
    pending: FramePendingEdits
  ): void {
    batch.removeLinks(pending.removedLinkIds)
    this.applyNodeActions(session, batch, doc, definitions, pending)
    this.resyncReplacedWidgetStorage(session, batch, doc, definitions, pending)
    this.resyncChangedNodeFields(session, batch, doc, definitions, pending)
    this.resyncChangedWidgets(session, batch, doc, definitions, pending)
    this.connectChangedLinks(session, batch, pending)
  }

  /**
   * Applies each `nodeActions` lifecycle edit: deletes a doc-deleted node
   * (or an 'update' whose new type no host definition recognizes, which the
   * doc cannot express as a same-type resync), then adds or resyncs
   * whatever is left from what the doc holds now.
   */
  private applyNodeActions(
    session: TargetSession,
    batch: GraphMutationBatch,
    doc: Y.Doc,
    definitions: () => SubgraphDefinitionIndex,
    pending: FramePendingEdits
  ): void {
    const payloads = new Map(
      [...pending.nodeActions]
        .filter(([, action]) => action !== 'delete')
        .map(
          ([id]) =>
            [
              id,
              readSemanticNode(doc, id, definitions, session.reportedErrors)
            ] as const
        )
    )
    for (const [id, action] of pending.nodeActions) {
      if (action === 'delete') {
        batch.deleteNode(toNodeId(id))
        continue
      }
      const payload = payloads.get(id)
      if (action === 'update' && !(payload && definitions().has(payload.type)))
        batch.deleteNode(toNodeId(id))
    }
    for (const [id, payload] of payloads) {
      if (!payload) continue
      this.upsertNode(
        batch,
        definitions,
        payload,
        pending.nodeActions.get(id) === 'add' ? 'add' : 'reconcile'
      )
    }
  }

  /**
   * A node whose widget storage was replaced wholesale, either the named
   * `widgets` map or the positional `__widgets_opaque` array (cmp writes
   * both in one transaction when a host's storage flips to opaque, and
   * deletes the opaque array when it flips back), is re-read in full. Skips
   * a node `applyNodeActions` already resynced this frame.
   */
  private resyncReplacedWidgetStorage(
    session: TargetSession,
    batch: GraphMutationBatch,
    doc: Y.Doc,
    definitions: () => SubgraphDefinitionIndex,
    pending: FramePendingEdits
  ): void {
    for (const id of new Set([
      ...pending.replacedWidgetMaps,
      ...pending.replacedOpaqueWidgets
    ])) {
      if (pending.nodeActions.has(id)) continue
      const payload = readSemanticNode(
        doc,
        id,
        definitions,
        session.reportedErrors
      )
      if (payload) this.upsertNode(batch, definitions, payload, 'reconcile')
    }
  }

  /**
   * A node whose scalar fields were edited by key (title, mode, flags,
   * properties, colors) is re-read so a live host resyncs those fields
   * without rebuilding its promoted widgets or slots. Skips a node already
   * resynced this frame by `applyNodeActions` or
   * `resyncReplacedWidgetStorage`.
   */
  private resyncChangedNodeFields(
    session: TargetSession,
    batch: GraphMutationBatch,
    doc: Y.Doc,
    definitions: () => SubgraphDefinitionIndex,
    pending: FramePendingEdits
  ): void {
    for (const id of pending.changedNodeFields) {
      if (
        pending.nodeActions.has(id) ||
        pending.replacedWidgetMaps.has(id) ||
        pending.replacedOpaqueWidgets.has(id)
      )
        continue
      const payload = readSemanticNode(
        doc,
        id,
        definitions,
        session.reportedErrors
      )
      if (payload) this.upsertNode(batch, definitions, payload, 'reconcile')
    }
  }

  /**
   * Patches each individually changed widget value onto its registered
   * widget, or falls back to a full node resync when a changed name is not
   * yet registered (the widget list grew since the last read). Skips a
   * node already resynced this frame by `applyNodeActions` or
   * `resyncReplacedWidgetStorage`.
   */
  private resyncChangedWidgets(
    session: TargetSession,
    batch: GraphMutationBatch,
    doc: Y.Doc,
    definitions: () => SubgraphDefinitionIndex,
    pending: FramePendingEdits
  ): void {
    for (const [id, names] of pending.changedWidgets) {
      if (pending.nodeActions.has(id) || pending.replacedWidgetMaps.has(id))
        continue
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
        if (payload) this.upsertNode(batch, definitions, payload, 'reconcile')
        continue
      }
      for (const name of names) {
        batch.setWidget(toNodeId(id), name, plain(widgets.get(name)))
      }
    }
  }

  /**
   * Re-`connect`s every changed link still present and readable in the doc.
   * A changed link that is gone, unreadable, or newly incompatible is not
   * connected here -- `removedLinkIdsFor` already routed it to
   * `batch.removeLinks` instead, called before any of this frame's node
   * edits so a link's old endpoint is never briefly reconnected mid-frame.
   */
  private connectChangedLinks(
    session: TargetSession,
    batch: GraphMutationBatch,
    pending: FramePendingEdits
  ): void {
    const incomingLinks = excludeIncompatibleLinks(
      [...pending.changedLinks.values()].filter(
        (link): link is SemanticLinkPayload => link !== null
      ),
      session.reportedErrors
    )
    for (const link of incomingLinks) batch.connect(link)
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
