import { sumBy } from 'es-toolkit'

import type { MissingMediaGroup, MissingMediaViewModel } from './types'

interface MissingMediaReference {
  mediaItem: MissingMediaViewModel
  nodeRef: MissingMediaViewModel['referencingNodes'][number]
}

export function getMissingMediaReferences(
  groups: MissingMediaGroup[]
): MissingMediaReference[] {
  return groups.flatMap((group) =>
    group.items.flatMap((mediaItem) =>
      mediaItem.referencingNodes.map((nodeRef) => ({ mediaItem, nodeRef }))
    )
  )
}

export function countMissingMediaReferences(
  groups: MissingMediaGroup[]
): number {
  return sumBy(groups, (group) =>
    sumBy(group.items, (item) => item.referencingNodes.length)
  )
}
