import type { MissingNodeType } from '@/types/comfy'

import type { MissingNodePack } from '../types'

const UNKNOWN_PACK_ID = 'unknown'

export function groupMissingNodesByPack(
  missingNodes: readonly MissingNodeType[]
): MissingNodePack[] {
  const byPack = new Map<string, Set<string>>()

  for (const node of missingNodes) {
    const type = typeof node === 'string' ? node : node.type
    const packId =
      typeof node === 'string' ? UNKNOWN_PACK_ID : node.cnrId || UNKNOWN_PACK_ID

    const existing = byPack.get(packId)
    if (existing) {
      existing.add(type)
    } else {
      byPack.set(packId, new Set([type]))
    }
  }

  return Array.from(byPack, ([pack_id, types]) => ({
    pack_id,
    node_types: Array.from(types)
  }))
}
