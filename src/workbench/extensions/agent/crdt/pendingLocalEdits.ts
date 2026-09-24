import { linksMap, nodesMap } from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'
import { isEqual } from 'es-toolkit'
import * as Y from 'yjs'

import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'

/**
 * The local human's edits the document has not yet reflected. A full sync
 * treats the document as authoritative for everything else: it leaves these
 * alone so an in-flight op cannot be undone by the state it is about to
 * change.
 */
export interface PendingLocalEdits {
  /** Document node ids with a pending local `delete_node`. */
  readonly deletedNodeIds: ReadonlySet<string>
  /** Live node ids with a pending local `add_node`. */
  readonly addedNodeIds: ReadonlySet<string>
  /** `widgetKey(nodeId, name)` entries with a pending local `set_widget`. */
  readonly widgetKeys: ReadonlySet<string>
  /** Link ids with a pending local `connect` or `disconnect`. */
  readonly linkIds: ReadonlySet<LinkId>
}

export const NO_PENDING_LOCAL_EDITS: PendingLocalEdits = {
  deletedNodeIds: new Set(),
  addedNodeIds: new Set(),
  widgetKeys: new Set(),
  linkIds: new Set()
}

export function widgetKey(nodeId: string | number, name: string): string {
  return `${String(nodeId)}:${name}`
}

/** Folds top-level ops into the edits a full sync must leave alone. */
export function collectPendingLocalEdits(ops: Iterable<Op>): PendingLocalEdits {
  const deletedNodeIds = new Set<string>()
  const addedNodeIds = new Set<string>()
  const widgetKeys = new Set<string>()
  const linkIds = new Set<LinkId>()
  for (const op of ops) {
    if ('path' in op && op.path != null) continue
    switch (op.op) {
      case 'delete_node':
        deletedNodeIds.add(String(op.node_id))
        break
      case 'add_node':
        addedNodeIds.add(String(op.node_id))
        break
      case 'set_widget':
        widgetKeys.add(widgetKey(op.node_id, op.widget))
        break
      case 'connect':
      case 'disconnect':
        linkIds.add(toLinkId(Number(op.link_id)))
        break
      default:
        break
    }
  }
  return { deletedNodeIds, addedNodeIds, widgetKeys, linkIds }
}

/**
 * Whether the document already carries the effect of an acknowledged local
 * op, so the op no longer needs protecting. Ops a full sync never contends
 * with (interior writes, node fields, clears, inserts) count as reflected.
 */
export function docReflects(doc: Y.Doc, op: Op): boolean {
  if ('path' in op && op.path != null) return true
  switch (op.op) {
    case 'delete_node':
      return !nodesMap(doc).has(String(op.node_id))
    case 'add_node':
      return nodesMap(doc).has(String(op.node_id))
    case 'set_widget': {
      const widgets = nodesMap(doc).get(String(op.node_id))?.get('widgets')
      if (!(widgets instanceof Y.Map)) return false
      const value: unknown = widgets.get(op.widget)
      return isEqual(
        value instanceof Y.AbstractType ? value.toJSON() : value,
        op.value
      )
    }
    case 'connect':
      return linksMap(doc).has(String(op.link_id))
    case 'disconnect':
      return !linksMap(doc).has(String(op.link_id))
    default:
      return true
  }
}
