import { nodesMap } from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'

import type { FrameChanges, NodeChange } from './liveGraphApplier'
import { docLinksIncident } from './liveGraphApplier'

/**
 * The live-graph changes that put a host-rejected human batch back the way
 * the document has it. Each op names exactly the node, widget, link, or field
 * register it claimed; replaying those registers from the document undoes the
 * live edit without touching anything else. A node the document lacks is
 * removed live along with its links; one it holds is restored with the
 * document links incident to it. Interior (`path`) writes address subgraph
 * definitions the applier never projects, so they have nothing to undo here.
 */
export function changesForRejectedOps(
  doc: Y.Doc,
  ops: readonly Op[]
): FrameChanges {
  const nodes = new Map<string, NodeChange>()
  const widgets = new Map<string, Set<string>>()
  const resyncNodes = new Set<string>()
  const links = new Set<string>()
  const docNodes = nodesMap(doc)
  const settleNode = (id: string): void => {
    if (!docNodes.has(id)) {
      nodes.set(id, 'delete')
      return
    }
    nodes.set(id, 'add')
    for (const link of docLinksIncident(doc, id)) links.add(String(link.id))
  }
  for (const op of ops) {
    if ('path' in op && op.path != null) continue
    switch (op.op) {
      case 'add_node':
      case 'delete_node':
        settleNode(String(op.node_id))
        break
      case 'clear':
        for (const id of op.removed_nodes) settleNode(String(id))
        break
      case 'set_widget': {
        const id = String(op.node_id)
        const names = widgets.get(id) ?? new Set<string>()
        names.add(op.widget)
        widgets.set(id, names)
        break
      }
      case 'set_node_field':
        resyncNodes.add(String(op.node_id))
        break
      case 'connect':
      case 'disconnect':
        links.add(String(op.link_id))
        break
      default:
        break
    }
  }
  return { nodes, widgets, resyncNodes, links }
}
