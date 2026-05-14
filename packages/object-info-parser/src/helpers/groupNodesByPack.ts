import { getNodeSource, NodeSourceType } from '../classifiers/nodeSource'
import type { ComfyNodeDef } from '../schemas/nodeDefSchema'
import { slugifyPackId } from './slugifyPackId'

export interface PackedNode {
  className: string
  def: ComfyNodeDef
}

export interface NodePack {
  id: string
  rawId: string
  rawIds: string[]
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

    const rawId = def.python_module.split('.')[1]?.split('@')[0]
    if (!rawId) {
      continue
    }

    const slug = slugifyPackId(rawId)
    if (!slug) {
      continue
    }

    const existing = byPackId.get(slug)
    const node = { className, def }

    if (existing) {
      existing.nodes.push(node)
      if (!existing.rawIds.includes(rawId)) {
        existing.rawIds.push(rawId)
      }
      continue
    }

    byPackId.set(slug, {
      id: slug,
      rawId,
      rawIds: [rawId],
      displayName: source.displayText,
      nodes: [node]
    })
  }

  return [...byPackId.values()].sort((a, b) => a.id.localeCompare(b.id))
}
