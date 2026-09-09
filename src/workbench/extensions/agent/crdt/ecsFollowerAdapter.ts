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

function plain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) return value.toJSON()
  return structuredClone(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  definitions: () => SubgraphDefinitionIndex
): SemanticNodePayload | null {
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
        reportError(
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
  return payload as SemanticNodePayload
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
    // The doc keeps the link while the live graph drops it, so surface the
    // drift instead of leaving the two silently diverged.
    reportError(
      new Error(
        `Subgraph host ${targetId} (${type}) link targets doc slot ${docSlot} (${
          name == null ? 'unnamed' : `'${name}'`
        }), which its definition does not declare unambiguously`
      ),
      {
        errorType: 'error_reconciling_agent_subgraph_host_slot',
        context: { nodeId: targetId, type, slot: docSlot, name: name ?? null }
      }
    )
    return null
  }
  return {
    targetSlot: slot,
    targetInputs: hostInputs(definition, docInputs ?? [])
  }
}

function readSemanticLink(
  doc: Y.Doc,
  id: string,
  definitions: SubgraphDefinitionIndex
): SemanticLinkPayload | null {
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
  const targetNodeId = String(tuple[3])
  const target = hostTarget(doc, definitions, targetNodeId, targetSlot)
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
  /** Nodes whose positional `__widgets_opaque` array was replaced. */
  readonly replacedOpaqueWidgets: Set<string>
  /** Nodes whose scalar fields (title, mode, flags, ...) changed in place. */
  readonly changedNodeFields: Set<string>
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
      replacedOpaqueWidgets: new Set<string>(),
      changedNodeFields: new Set<string>(),
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
        const link = readSemanticLink(doc, id, definitions())
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
        session.links.has(id) ? readSemanticLink(doc, id, definitions()) : null
      ])
    )
    const removedLinkIds = [...changedLinks].flatMap(([id, link]) =>
      link ? [] : [Number(id)]
    )
    const committed = session.mutations.batch(frameContext(update), (batch) => {
      // A SubgraphNode host that is already live must never be rebuilt from
      // its doc entry: `reconcileNode` (and delete + `addNode`) replaces the
      // host's input list in place, which drops the `widgetId` /
      // `_subgraphSlot` bindings its promoted widgets hang off, leaving the
      // host with no widgets at all. Resync the host's scalar fields (title,
      // mode, flags, properties, colors) and write the promoted values by name
      // instead; `readSemanticNode` has already keyed them from the
      // definition. A host whose stored values are not a record (malformed
      // opaque payload) keeps its widgets untouched rather than wiped.
      const isLiveHost = (payload: SemanticNodePayload) =>
        definitions().has(payload.type) && batch.hasNode(toNodeId(payload.id))
      const upsertNode = (
        payload: SemanticNodePayload,
        mode: 'add' | 'reconcile'
      ) => {
        if (!isLiveHost(payload)) {
          if (mode === 'add') batch.addNode(payload)
          else batch.reconcileNode(payload)
          return
        }
        batch.reconcileNodeFields(payload)
        const values = payload.widgets_values
        if (!isRecord(values)) return
        for (const [name, value] of Object.entries(values)) {
          batch.setWidget(toNodeId(payload.id), name, value)
        }
      }

      if (reconcile) {
        const nodes = [...session.nodes.keys()].flatMap((id) => {
          const payload = readSemanticNode(doc, id, definitions)
          return payload ? [payload] : []
        })
        const links = [...session.links.keys()].flatMap((id) => {
          const link = readSemanticLink(doc, id, definitions())
          return link ? [link] : []
        })
        batch.removeMissing(
          nodes.map(({ id }) => toNodeId(id)),
          links.map(({ id }) => id)
        )
        for (const payload of nodes) upsertNode(payload, 'reconcile')
        for (const link of links) batch.connect(link)
        return
      }

      batch.removeLinks(removedLinkIds)
      // A replaced (`update`) node is deleted and re-added, except a live host,
      // whose promoted values are rewritten in place by `upsertNode` below.
      const payloads = new Map(
        [...nodeActions]
          .filter(([, action]) => action !== 'delete')
          .map(([id]) => [id, readSemanticNode(doc, id, definitions)] as const)
      )
      for (const [id, action] of nodeActions) {
        if (action === 'delete') {
          batch.deleteNode(toNodeId(id))
          continue
        }
        const payload = payloads.get(id)
        if (action === 'update' && !(payload && isLiveHost(payload)))
          batch.deleteNode(toNodeId(id))
      }
      for (const payload of payloads.values()) {
        if (payload) upsertNode(payload, 'add')
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
        const payload = readSemanticNode(doc, id, definitions)
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
        const payload = readSemanticNode(doc, id, definitions)
        if (payload) upsertNode(payload, 'reconcile')
      }
      for (const [id, names] of changedWidgets) {
        if (nodeActions.has(id) || replacedWidgetMaps.has(id)) continue
        const node = session.nodes.get(id)
        const widgets = node?.get('widgets')
        if (!(widgets instanceof Y.Map)) continue
        if ([...names].some((name) => !widgets.has(name))) {
          const payload = readSemanticNode(doc, id, definitions)
          if (payload) upsertNode(payload, 'reconcile')
          continue
        }
        for (const name of names) {
          batch.setWidget(toNodeId(id), name, plain(widgets.get(name)))
        }
      }
      for (const link of changedLinks.values()) {
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
    session.replacedOpaqueWidgets.clear()
    session.changedNodeFields.clear()
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

      if (event.path.length !== 1) continue
      if (event.keysChanged.has('widgets')) session.replacedWidgetMaps.add(id)
      if (event.keysChanged.has(OPAQUE_WIDGETS_KEY))
        session.replacedOpaqueWidgets.add(id)
      // Scalar fields edited by key on the node map (rather than by replacing
      // the whole node) would otherwise never reach the live node.
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
