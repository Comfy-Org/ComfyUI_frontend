import { OUT_OF_MEMORY_CATALOG_ID } from '@/platform/workflowErrors/errorCatalog/catalogIds'

import type { ErrorGroup } from '@/components/rightSidePanel/errors/types'

/** Whether a group holds a run error the catalog reads as out of GPU memory. */
export function isOutOfMemoryGroup(group: ErrorGroup): boolean {
  return (
    group.type === 'execution' &&
    group.cards.some((card) =>
      card.errors.some((error) => error.catalogId === OUT_OF_MEMORY_CATALOG_ID)
    )
  )
}
