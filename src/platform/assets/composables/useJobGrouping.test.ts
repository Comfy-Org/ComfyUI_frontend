import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useJobGrouping } from '@/platform/assets/composables/useJobGrouping'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

function asset(id: string, jobId?: string): AssetItem {
  return {
    id,
    name: `${id}.png`,
    tags: ['output'],
    job_id: jobId
  }
}

function setup(
  items: AssetItem[],
  { enabled = true, holdBackTrailing = false } = {}
) {
  const assets = ref(items)
  const grouping = useJobGrouping({
    assets,
    enabled: ref(enabled),
    holdBackTrailing: ref(holdBackTrailing)
  })
  return { assets, ...grouping }
}

describe('useJobGrouping', () => {
  it('passes assets through unchanged when disabled', () => {
    const items = [asset('a', 'job1'), asset('b', 'job1')]
    const { groupedAssets } = setup(items, { enabled: false })
    expect(groupedAssets.value).toEqual(items)
  })

  it('buckets assets by job_id with first occurrence as representative', () => {
    const { groupedAssets, getGroupCount } = setup([
      asset('a1', 'job1'),
      asset('b1', 'job2'),
      asset('a2', 'job1'),
      asset('a3', 'job1')
    ])

    expect(groupedAssets.value.map((a) => a.id)).toEqual(['a1', 'b1'])
    expect(getGroupCount(asset('a1', 'job1'))).toBe(3)
    expect(getGroupCount(asset('b1', 'job2'))).toBe(1)
  })

  it('treats assets without job_id as singleton groups', () => {
    const { groupedAssets, getGroupCount } = setup([
      asset('a', 'job1'),
      asset('x'),
      asset('y')
    ])

    expect(groupedAssets.value.map((a) => a.id)).toEqual(['a', 'x', 'y'])
    expect(getGroupCount(asset('x'))).toBe(1)
  })

  it('exposes group members for drill-in', () => {
    const { getGroup } = setup([
      asset('a1', 'job1'),
      asset('b1', 'job2'),
      asset('a2', 'job1')
    ])

    const group = getGroup(asset('a2', 'job1'))
    expect(group?.jobId).toBe('job1')
    expect(group?.assets.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('holds back the group containing the trailing asset', () => {
    const { groupedAssets } = setup(
      [asset('a1', 'job1'), asset('b1', 'job2'), asset('b2', 'job2')],
      { holdBackTrailing: true }
    )

    // job2 owns the last loaded asset; the next page may add more members.
    expect(groupedAssets.value.map((a) => a.id)).toEqual(['a1'])
  })

  it('keeps the trailing group when it is the only group', () => {
    const { groupedAssets } = setup(
      [asset('a1', 'job1'), asset('a2', 'job1')],
      { holdBackTrailing: true }
    )

    expect(groupedAssets.value.map((a) => a.id)).toEqual(['a1'])
  })

  it('reacts to asset list changes', () => {
    const { assets, groupedAssets } = setup([asset('a1', 'job1')])
    expect(groupedAssets.value).toHaveLength(1)

    assets.value = [...assets.value, asset('a2', 'job1'), asset('c1', 'job3')]
    expect(groupedAssets.value.map((a) => a.id)).toEqual(['a1', 'c1'])
  })
})
