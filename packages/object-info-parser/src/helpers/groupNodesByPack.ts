import { getNodeSource, NodeSourceType } from '../classifiers/nodeSource'
import type { ComfyNodeDef } from '../schemas/nodeDefSchema'

export interface PackedNode {
  className: string
  def: ComfyNodeDef
}

export interface NodePack {
  id: string
  displayName: string
  nodes: PackedNode[]
}

export function groupNodesByPack(
  defs: Record<string, ComfyNodeDef>
): NodePack[] {
  const byPackId = new Map<string, NodePack>()

  for (const [className, def] of Object.entries(defs)) {
    const source = getNodeSource(def.python_module, def.essentials_category)
    if (source.type !== NodeSourceType.CustomNodes) {
      continue
    }

    const packId = def.python_module.split('.')[1]?.split('@')[0]
    if (!packId) {
      continue
    }

    const existing = byPackId.get(packId)
    const node = { className, def }

    if (existing) {
      existing.nodes.push(node)
      continue
    }

    byPackId.set(packId, {
      id: packId,
      displayName: source.displayText,
      nodes: [node]
    })
  }

  return [...byPackId.values()].sort((a, b) => a.id.localeCompare(b.id))
}
