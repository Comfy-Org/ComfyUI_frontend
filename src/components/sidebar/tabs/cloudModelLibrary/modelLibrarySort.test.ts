import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { buildProviderGroups } from './modelLibrarySort'
import type { SidebarItem } from './modelLibrarySort'

function assetItem(
  name: string,
  overrides: Partial<AssetItem> = {}
): SidebarItem {
  return {
    kind: 'asset',
    asset: { id: name, name, tags: ['models'], ...overrides }
  }
}

const names = (items: SidebarItem[]) =>
  items.map((i) => (i.kind === 'asset' ? i.asset.name : i.nodeDef.name))

describe('buildProviderGroups — flat (non base-model) modes', () => {
  const items = [assetItem('Zebra'), assetItem('apple'), assetItem('Mango')]

  it('sorts a single group A–Z for nameAsc (case-insensitive)', () => {
    const [group] = buildProviderGroups(items, 'nameAsc', false)
    expect(group.provider).toBe('')
    expect(names(group.items)).toEqual(['apple', 'Mango', 'Zebra'])
  })

  it('reverses for nameDesc', () => {
    const [group] = buildProviderGroups(items, 'nameDesc', false)
    expect(names(group.items)).toEqual(['Zebra', 'Mango', 'apple'])
  })

  it('orders by timestamp for recent, newest first', () => {
    const dated = [
      assetItem('old', { created_at: '2020-01-01T00:00:00Z' }),
      assetItem('new', { created_at: '2024-01-01T00:00:00Z' }),
      assetItem('mid', { created_at: '2022-01-01T00:00:00Z' })
    ]
    const [group] = buildProviderGroups(dated, 'recent', false)
    expect(names(group.items)).toEqual(['new', 'mid', 'old'])
  })
})

describe('buildProviderGroups — search active', () => {
  it('preserves input order and does not re-sort', () => {
    const items = [assetItem('Zebra'), assetItem('apple')]
    const [group] = buildProviderGroups(items, 'nameAsc', true)
    expect(group.provider).toBe('')
    expect(names(group.items)).toEqual(['Zebra', 'apple'])
  })
})

describe('buildProviderGroups — base-model grouping', () => {
  it('buckets by base model with the unknown bucket anchored last', () => {
    const items = [
      assetItem('sdxl-model', { metadata: { base_model: 'SDXL' } }),
      assetItem('sd15-model', { metadata: { base_model: 'SD 1.5' } }),
      assetItem('no-base-model')
    ]
    const groups = buildProviderGroups(items, 'baseModelAsc', false)
    expect(groups.map((g) => g.provider)).toEqual(['SD 1.5', 'SDXL', '—'])
    expect(names(groups[2].items)).toEqual(['no-base-model'])
  })

  it('reverses bucket order for baseModelDesc but keeps unknown last', () => {
    const items = [
      assetItem('sdxl-model', { metadata: { base_model: 'SDXL' } }),
      assetItem('sd15-model', { metadata: { base_model: 'SD 1.5' } }),
      assetItem('no-base-model')
    ]
    const groups = buildProviderGroups(items, 'baseModelDesc', false)
    expect(groups.map((g) => g.provider)).toEqual(['SDXL', 'SD 1.5', '—'])
  })
})
