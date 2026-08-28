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

type NodeRootAction = 'add' | 'update' | 'delete'

function plain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) return value.toJSON()
  return structuredClone(value)
}

export function readSemanticNode(
  doc: Y.Doc,
  id: string
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
  // The normalized root key is authoritative even when a stale payload's
  // embedded id used a different JSON representation (DQ-15).
  payload.id = id
  payload.type = type
  return payload as SemanticNodePayload
}

export function readSemanticLink(
  doc: Y.Doc,
  id: string
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

/**
 * Observes the actual Yjs transaction effects integrated by FollowerDoc and
 * applies those changed entity keys directly to ECS stores. It retains no
 * second graph snapshot and never calls the shared applier or LiteGraph.
 */
export class EcsFollowerAdapter {
  private follower: FollowerDoc | null = null
  private nodes: Y.Map<Y.Map<unknown>> | null = null
  private links: Y.Map<unknown> | null = null
  private readonly nodeActions = new Map<string, NodeRootAction>()
  private readonly changedWidgets = new Map<string, Set<string>>()
  private readonly changedLinks = new Set<string>()
  private reconcileNextFrame = true

  constructor(private readonly mutations: GraphMutations) {}

  bind(follower: FollowerDoc): void {
    this.unbind()
    this.follower = follower
    this.nodes = nodesMap(follower.doc)
    this.links = linksMap(follower.doc)
    this.reconcileNextFrame = true
    this.nodes.observeDeep(this.onNodesChanged)
    this.links.observe(this.onLinksChanged)
  }

  /** Apply effects collected synchronously while the bridge integrated frame. */
  applyFrame(update: DocUpdate): boolean {
    const follower = this.follower
    if (!follower) return false
    const nodeActions = new Map(this.nodeActions)
    const changedWidgets = new Map(
      [...this.changedWidgets].map(([id, names]) => [id, new Set(names)])
    )
    const changedLinkIds = new Set(this.changedLinks)
    const reconcile = this.reconcileNextFrame
    this.reconcileNextFrame = false
    this.discardPending()

    // Re-adding a node under one normalized id is a new incarnation. Its
    // current links may be unchanged at the root map, so explicitly reconcile
    // every incident authoritative link after replacing the old shell.
    const replacedNodeIds = new Set(
      [...nodeActions]
        .filter(([, action]) => action === 'update')
        .map(([id]) => id)
    )
    if (replacedNodeIds.size > 0) {
      linksMap(follower.doc).forEach((_raw, id) => {
        const link = readSemanticLink(follower.doc, id)
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
      linksMap(follower.doc).has(id) ? [] : [Number(id)]
    )
    return this.mutations.batch(frameContext(update), (batch) => {
      // Input replacement can retire an incumbent even when delete-wins leaves
      // no new link to install, so removals are an independent derived effect.
      batch.removeLinks(removedLinkIds)
      // Delete/update roots first so a same-id update starts a fresh widget
      // incarnation and cannot retain stale values (DQ-11).
      for (const [id, action] of nodeActions) {
        if (action === 'delete' || action === 'update') {
          batch.deleteNode(toNodeId(id))
        }
      }
      for (const [id, action] of nodeActions) {
        if (action === 'delete') continue
        const payload = readSemanticNode(follower.doc, id)
        if (!payload) continue
        if (reconcile && action === 'add') batch.reconcileNode(payload)
        else batch.addNode(payload)
      }
      for (const [id, names] of changedWidgets) {
        if (nodeActions.has(id)) continue
        const node = nodesMap(follower.doc).get(id)
        const widgets = node?.get('widgets')
        if (!(widgets instanceof Y.Map)) continue
        for (const name of names) {
          if (widgets.has(name)) {
            batch.setWidget(toNodeId(id), name, plain(widgets.get(name)))
          }
        }
      }
      for (const id of changedLinkIds) {
        const link = readSemanticLink(follower.doc, id)
        if (link) batch.connect(link)
      }
    })
  }

  /** Explicit lineage reset only; ordinary reconnect/gap recovery never calls it. */
  clearForReset(context: RemoteMutationContext): boolean {
    this.discardPending()
    return this.mutations.clearSemanticGraph(context)
  }

  discardPending(): void {
    this.nodeActions.clear()
    this.changedWidgets.clear()
    this.changedLinks.clear()
  }

  destroy(): void {
    this.unbind()
    this.discardPending()
  }

  private unbind(): void {
    this.nodes?.unobserveDeep(this.onNodesChanged)
    this.links?.unobserve(this.onLinksChanged)
    this.nodes = null
    this.links = null
    this.follower = null
  }

  private readonly onNodesChanged = (
    events: Y.YEvent<Y.AbstractType<unknown>>[]
  ): void => {
    for (const event of events) {
      if (!(event instanceof Y.YMapEvent)) continue
      if (event.target === this.nodes) {
        for (const [id, change] of event.changes.keys) {
          this.nodeActions.set(id, change.action)
        }
        continue
      }

      const id = String(event.path[0] ?? '')
      if (!id) continue
      if (event.path[1] === 'widgets') {
        const names = this.changedWidgets.get(id) ?? new Set<string>()
        for (const name of event.keysChanged) names.add(name)
        this.changedWidgets.set(id, names)
        continue
      }

      // A node that had no widget map gains one on its first set_widget.
      if (event.path.length === 1 && event.keysChanged.has('widgets')) {
        const follower = this.follower
        if (!follower) continue
        const node = nodesMap(follower.doc).get(id)
        const widgets = node?.get('widgets')
        if (widgets instanceof Y.Map) {
          this.changedWidgets.set(id, new Set(widgets.keys()))
        }
      }
    }
  }

  private readonly onLinksChanged = (event: Y.YMapEvent<unknown>): void => {
    for (const id of event.keysChanged) this.changedLinks.add(id)
  }
}
