import type { UUID } from '@/utils/uuid'

import { useEntityIdStore } from './entityIdStore'
import { useGraphMetadataStore } from './graphMetadataStore'

type GraphIdOwner = { kind: 'root' } | { kind: 'subgraph'; rootGraphId: UUID }

export function rekeyGraphId(
  previousId: UUID,
  nextId: UUID,
  owner: GraphIdOwner
): boolean {
  if (previousId === nextId) return true

  const metadata = useGraphMetadataStore()
  const entityIds = useEntityIdStore()
  const metadataOccupied =
    owner.kind === 'root'
      ? metadata.hasRoot(nextId)
      : metadata.has(owner.rootGraphId, nextId)
  const entityIdsOccupied = owner.kind === 'root' && entityIds.has(nextId)

  if (metadataOccupied || entityIdsOccupied) {
    return false
  }

  if (owner.kind === 'root') {
    metadata.rekeyRoot(previousId, nextId)
    entityIds.rekey(previousId, nextId)
  } else {
    metadata.rekeyGraph(owner.rootGraphId, previousId, nextId)
  }
  return true
}
