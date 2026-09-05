import { describe, expect, it } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import { SortableAlgoliaField } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import { getPackSortValue } from '@/workbench/extensions/manager/utils/nodePackSort'

type NodePack = components['schemas']['Node']

const pack: NodePack = {
  id: '1',
  name: 'Test Pack',
  downloads: 100,
  publisher: { id: 'pub1', name: 'Publisher One' },
  latest_version: { version: '1.0.0', createdAt: '2024-01-15T10:00:00Z' },
  created_at: '2024-01-01T10:00:00Z'
}

describe('getPackSortValue', () => {
  it('maps each field to its comparable value', () => {
    expect(getPackSortValue(pack, SortableAlgoliaField.Downloads)).toBe(100)
    expect(getPackSortValue(pack, SortableAlgoliaField.Name)).toBe('Test Pack')
    expect(getPackSortValue(pack, SortableAlgoliaField.Publisher)).toBe(
      'Publisher One'
    )
    expect(getPackSortValue(pack, SortableAlgoliaField.Created)).toBe(
      new Date('2024-01-01T10:00:00Z').getTime()
    )
    expect(getPackSortValue(pack, SortableAlgoliaField.Updated)).toBe(
      new Date('2024-01-15T10:00:00Z').getTime()
    )
  })

  it('falls back to neutral values when data is missing or the field is unknown', () => {
    const incomplete: NodePack = { id: '1', name: 'Incomplete' }
    expect(getPackSortValue(incomplete, SortableAlgoliaField.Downloads)).toBe(0)
    expect(getPackSortValue(incomplete, SortableAlgoliaField.Publisher)).toBe(
      ''
    )
    expect(getPackSortValue(incomplete, SortableAlgoliaField.Updated)).toBe(0)
    expect(getPackSortValue(pack, 'unknown')).toBe(0)
  })
})
