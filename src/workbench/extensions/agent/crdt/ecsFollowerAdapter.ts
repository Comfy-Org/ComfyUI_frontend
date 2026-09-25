import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type {
  GraphMutationBatchResult,
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
 * A rejected batch (no scope available) arms `reconcileNextFrame`, but that
 * only fires on the next *incoming* frame, which may never arrive (e.g. the
 * user never sends another agent message). This timed retry loop gives the
 * scope race a fast, self-driven chance to resolve instead of leaving the
 * stale doc/live mismatch on screen until some unrelated later frame lands.
 */
const RECONCILE_FAST_RETRY_LIMIT = 20
const RECONCILE_RETRY_INTERVAL_MS = 200
const RECONCILE_SLOW_RETRY_INTERVAL_MS = 2_000

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
 * The local human's edits the host has not yet reflected in the doc. A full
 * reconcile treats the doc as authoritative for everything else; without
 * this seam it would recreate a node whose delete is still on its way.
 */
export interface LocalIntent {
  /** Doc node ids (string keys) with a pending human `delete_node`. */
  pendingDeletes(workflowId: string): ReadonlySet<string>
}

const NO_LOCAL_INTENT: LocalIntent = { pendingDeletes: () => new Set() }

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

function mergeRecoveryFrame(first: DocUpdate, latest: DocUpdate): DocUpdate {
  const opIds = [...new Set([...(first.opIds ?? []), ...(latest.opIds ?? [])])]
  return {
    ...latest,
    actor:
      first.actor === latest.actor
        ? first.actor
        : first.actor || latest.actor
          ? 'agent-reconcile'
          : undefined,
    ...(opIds.length > 0 ? { opIds } : { opIds: undefined })
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
  batchRecovery: BatchRecoveryState
  liveSweepRecovery: LiveSweepRecoveryState
}

type BatchRecoveryState =
  | { kind: 'idle' }
  | {
      kind: 'scheduled'
      timer: ReturnType<typeof setTimeout>
      attempt: number
      frame: DocUpdate
    }
  | { kind: 'applying'; attempt: number; frame: DocUpdate }

type LiveSweepRecoveryState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'scheduled'; timer: ReturnType<typeof setTimeout> }

/**
 * Projects each subscribed semantic document into its own ECS mutation stream.
 * Target sessions own their Yjs observers, pending effects, and apply queue;
 * one workflow can therefore never consume or overwrite another workflow's
 * follower state.
 */
export class EcsFollowerAdapter {
  private readonly targets = new Map<string, TargetSession>()

  constructor(
    private readonly mutations: MutationsForTarget,
    private readonly intent: LocalIntent = NO_LOCAL_INTENT,
    private readonly onReconcileRetryCommitted: (
      workflowId: string
    ) => void = () => undefined
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
    this.clearReconcileRetry(session)
    this.clearLiveSweepRetry(session)
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
    const session = this.targets.get(workflowId)
    if (!session) return false
    this.discardSessionPending(session)
    this.clearReconcileRetry(session)
    this.clearLiveSweepRetry(session)
    session.reconcileNextFrame = false
    return session.mutations.clearSemanticGraph(context)
  }

  discardPending(workflowId: string): void {
    const session = this.targets.get(workflowId)
    if (!session) return
    this.discardSessionPending(session)
    // Same reasoning as `clearForReset`: a schema-rejected frame is a
    // fail-closed gate, and a stale retry firing later would silently
    // re-apply the very state that gate just refused.
    this.clearReconcileRetry(session)
    this.clearLiveSweepRetry(session)
    session.reconcileNextFrame = false
  }

  destroy(): void {
    for (const workflowId of Array.from(this.targets.keys()))
      this.unbind(workflowId)
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
      batchRecovery: { kind: 'idle' },
      liveSweepRecovery: { kind: 'idle' },
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
    const removedLinkIds = [...changedLinks].flatMap(([id, link]) => {
      if (link && !isIncompatibleLinkType(link)) return []
      const linkId = resolveLinkMapKey(id)
      return linkId === null ? [] : [linkId]
    })
    const result = session.mutations.batchResult(
      frameContext(update),
      (batch) => {
        // A SubgraphNode host that is already live must never be rebuilt from
        // its doc entry: `reconcileNode` (and delete + `addNode`) replaces the
        // host's input list in place, which drops the `widgetId` /
        // `_subgraphSlot` bindings its promoted widgets hang off, leaving the
        // host with no widgets at all. Resync the host's scalar fields (title,
        // mode, flags, properties, colors) and promoted values only;
        // `readSemanticNode` has already keyed the values from the definition.
        const isHost = (payload: SemanticNodePayload) =>
          definitions().has(payload.type)
        const upsertNode = (
          payload: SemanticNodePayload,
          mode: 'add' | 'reconcile'
        ) => {
          if (mode === 'add') batch.addNode(payload)
          else if (isHost(payload)) batch.reconcileNodeFields(payload)
          else batch.reconcileNode(payload)
        }

        if (reconcile) {
          const pendingDeletes = this.intent.pendingDeletes(session.workflowId)
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
            nodes.map(({ id }) => toNodeId(id)),
            links.map(({ id }) => id)
          )
          for (const payload of nodes) upsertNode(payload, 'reconcile')
          for (const link of links) batch.connect(link)
          return
        }

        batch.removeLinks(removedLinkIds)
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
        for (const [id, payload] of payloads) {
          if (!payload) continue
          upsertNode(
            payload,
            nodeActions.get(id) === 'add' ? 'add' : 'reconcile'
          )
        }
        // A node whose widget storage was replaced wholesale, either the named
        // `widgets` map or the positional `__widgets_opaque` array (cmp writes
        // both in one transaction when a host's storage flips to opaque, and
        // deletes the opaque array when it flips back), is re-read in full.
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
        // A node whose scalar fields were edited by key (title, mode, flags,
        // properties, colors) is re-read so a live host resyncs those fields
        // without rebuilding its promoted widgets or slots.
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
        const incomingLinks = excludeIncompatibleLinks(
          [...changedLinks.values()].filter(
            (link): link is SemanticLinkPayload => link !== null
          ),
          session.reportedErrors
        )
        for (const link of incomingLinks) batch.connect(link)
      }
    )

    // The pending sets were snapshotted and cleared before `batch` ran, so a
    // rejected batch (no scope, or validation failure) has already lost the
    // incremental record of this frame. Arm a full reconcile for the next
    // frame so the dropped edits are re-read from the doc instead of falling
    // through to incremental handling that never revisits them.
    const committed = result.kind === 'committed'
    session.reconcileNextFrame = !committed
    this.handleReconcileOutcome(session, update, result)
    return committed
  }

  private handleReconcileOutcome(
    session: TargetSession,
    update: DocUpdate,
    result: GraphMutationBatchResult
  ): void {
    if (result.kind === 'committed') {
      this.clearReconcileRetry(session)
      return
    }
    if (result.reason === 'validation') {
      if (session.batchRecovery.kind === 'applying')
        session.batchRecovery = { kind: 'idle' }
      return
    }

    if (session.batchRecovery.kind === 'scheduled') {
      session.batchRecovery.frame = mergeRecoveryFrame(
        session.batchRecovery.frame,
        update
      )
      return
    }
    if (session.batchRecovery.kind === 'applying') {
      this.scheduleReconcileRetry(
        session,
        session.batchRecovery.frame,
        session.batchRecovery.attempt
      )
      return
    }
    this.scheduleReconcileRetry(session, update, 0)
  }

  private scheduleReconcileRetry(
    session: TargetSession,
    frame: DocUpdate,
    previousAttempts: number
  ): void {
    const attempt = previousAttempts + 1
    const delay =
      attempt <= RECONCILE_FAST_RETRY_LIMIT
        ? RECONCILE_RETRY_INTERVAL_MS
        : RECONCILE_SLOW_RETRY_INTERVAL_MS
    const scheduled: Extract<BatchRecoveryState, { kind: 'scheduled' }> = {
      kind: 'scheduled',
      timer: setTimeout(() => {
        if (this.targets.get(session.workflowId) !== session) return
        if (session.batchRecovery !== scheduled) return
        if (!session.reconcileNextFrame) return
        const applying = {
          kind: 'applying',
          attempt: scheduled.attempt,
          frame: scheduled.frame
        } satisfies BatchRecoveryState
        session.batchRecovery = applying
        let committed: boolean
        try {
          committed = this.applyFrame(applying.frame)
        } catch (error) {
          reportError(
            error instanceof Error ? error : new Error(String(error)),
            {
              errorType: 'error_agent_reconcile_retry_threw',
              context: { workflowId: session.workflowId }
            }
          )
          if (session.batchRecovery === applying)
            this.scheduleReconcileRetry(
              session,
              applying.frame,
              applying.attempt
            )
          return
        }
        if (committed) this.runLiveGraphSweep(session)
      }, delay),
      attempt,
      frame
    }
    session.batchRecovery = scheduled
  }

  private runLiveGraphSweep(session: TargetSession): void {
    if (session.liveSweepRecovery.kind === 'scheduled')
      clearTimeout(session.liveSweepRecovery.timer)
    const running = { kind: 'running' } satisfies LiveSweepRecoveryState
    session.liveSweepRecovery = running
    try {
      this.onReconcileRetryCommitted(session.workflowId)
      if (session.liveSweepRecovery === running)
        session.liveSweepRecovery = { kind: 'idle' }
    } catch (error) {
      reportError(error instanceof Error ? error : new Error(String(error)), {
        errorType: 'error_agent_reconcile_live_sweep_threw',
        context: { workflowId: session.workflowId }
      })
      if (session.liveSweepRecovery !== running) return
      const scheduled: Extract<LiveSweepRecoveryState, { kind: 'scheduled' }> =
        {
          kind: 'scheduled',
          timer: setTimeout(() => {
            if (this.targets.get(session.workflowId) !== session) return
            if (session.liveSweepRecovery !== scheduled) return
            this.runLiveGraphSweep(session)
          }, RECONCILE_SLOW_RETRY_INTERVAL_MS)
        }
      session.liveSweepRecovery = scheduled
    }
  }

  private clearReconcileRetry(session: TargetSession): void {
    if (session.batchRecovery.kind === 'scheduled')
      clearTimeout(session.batchRecovery.timer)
    session.batchRecovery = { kind: 'idle' }
  }

  private clearLiveSweepRetry(session: TargetSession): void {
    if (session.liveSweepRecovery.kind === 'scheduled')
      clearTimeout(session.liveSweepRecovery.timer)
    session.liveSweepRecovery = { kind: 'idle' }
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
