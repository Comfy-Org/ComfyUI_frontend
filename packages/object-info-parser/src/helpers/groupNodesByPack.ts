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

/**
 * Group custom Comfy node definitions into packs keyed by a slugified pack identifier.
 *
 * Processes the provided node definitions, selects those identified as custom nodes, extracts
 * a raw pack identifier from each definition's `python_module`, converts it to a slug, and
 * aggregates nodes that share the same slug into a single `NodePack`.
 *
 * @param defs - Map of class name to `ComfyNodeDef` objects to be grouped
 * @returns An array of `NodePack` objects sorted by `id` (ascending). Each `NodePack` includes:
 * - `id`: the slugified pack identifier
 * - `rawId`: the raw identifier extracted from a representative node's `python_module`
 * - `rawIds`: all distinct raw identifiers that were mapped to the same slug
 * - `displayName`: display text taken from the node source metadata
 * - `nodes`: the list of packed node entries (`{ className, def }`)
 */
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
