import type { components } from '@/types/comfyRegistryTypes'
import { SortableAlgoliaField } from '@/workbench/extensions/manager/types/comfyManagerTypes'

type NodePack = components['schemas']['Node']

export interface SortableField<T = string> {
  id: T
  label: string
  direction: 'asc' | 'desc'
}

export const PACK_SORTABLE_FIELDS: SortableField[] = [
  { id: SortableAlgoliaField.Downloads, label: 'Downloads', direction: 'desc' },
  { id: SortableAlgoliaField.Created, label: 'Created', direction: 'desc' },
  { id: SortableAlgoliaField.Updated, label: 'Updated', direction: 'desc' },
  { id: SortableAlgoliaField.Publisher, label: 'Publisher', direction: 'asc' },
  { id: SortableAlgoliaField.Name, label: 'Name', direction: 'asc' }
]

const toTime = (value: string | undefined | null): number =>
  value ? new Date(value).getTime() : 0

export const getPackSortValue = (
  pack: NodePack,
  field: string
): string | number => {
  switch (field) {
    case SortableAlgoliaField.Downloads:
      return pack.downloads ?? 0
    case SortableAlgoliaField.Created:
      return toTime(pack.created_at)
    case SortableAlgoliaField.Updated:
      return toTime(pack.latest_version?.createdAt)
    case SortableAlgoliaField.Publisher:
      return pack.publisher?.name ?? ''
    case SortableAlgoliaField.Name:
      return pack.name ?? ''
    default:
      return 0
  }
}
