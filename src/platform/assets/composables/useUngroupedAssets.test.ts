import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as OutputAssetUtil from '@/platform/assets/utils/outputAssetUtil'

import { useUngroupedAssets } from './useUngroupedAssets'

const mocks = vi.hoisted(() => ({
  resolveOutputAssetItems: vi.fn()
}))

vi.mock('@/platform/assets/utils/outputAssetUtil', async (importOriginal) => {
  const actual = await importOriginal<typeof OutputAssetUtil>()
  return {
    ...actual,
    resolveOutputAssetItems: mocks.resolveOutputAssetItems
  }
})

function createAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    name: 'image.png',
    tags: [],
    created_at: '2025-01-01T00:00:00.000Z',
    user_metadata: undefined,
    ...overrides
  }
}

function createMultiOutputAsset(
  jobId: string,
  outputCount: number,
  overrides: Partial<AssetItem> = {}
): AssetItem {
  return createAsset({
    id: `asset-${jobId}`,
    name: `${jobId}.png`,
    user_metadata: {
      jobId,
      nodeId: 'node-1',
      subfolder: 'outputs',
      outputCount
    },
    ...overrides
  })
}

describe('useUngroupedAssets', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns assets as-is when groupByJob is true', async () => {
    const asset = createAsset()
    const assets = ref([asset])
    const groupByJob = ref(true)

    const { ungroupedAssets } = useUngroupedAssets(assets, groupByJob)
    await flushPromises()

    expect(ungroupedAssets.value).toEqual([asset])
    expect(mocks.resolveOutputAssetItems).not.toHaveBeenCalled()
  })

  it('returns single-output assets as-is when ungrouped', async () => {
    const singleOutput = createAsset({ id: 'single' })
    const singleCountAsset = createMultiOutputAsset('job-1', 1)
    const assets = ref([singleOutput, singleCountAsset])
    const groupByJob = ref(false)

    const { ungroupedAssets } = useUngroupedAssets(assets, groupByJob)
    await flushPromises()

    expect(ungroupedAssets.value).toEqual([singleOutput, singleCountAsset])
    expect(mocks.resolveOutputAssetItems).not.toHaveBeenCalled()
  })

  it('resolves multi-output assets into individual children', async () => {
    const parent = createMultiOutputAsset('job-1', 3)
    const childA = createAsset({ id: 'child-a', name: 'child-a.png' })
    const childB = createAsset({ id: 'child-b', name: 'child-b.png' })
    const childC = createAsset({ id: 'child-c', name: 'child-c.png' })

    mocks.resolveOutputAssetItems.mockResolvedValue([childA, childB, childC])

    const assets = ref([parent])
    const groupByJob = ref(false)

    const { ungroupedAssets } = useUngroupedAssets(assets, groupByJob)
    await flushPromises()

    expect(ungroupedAssets.value).toEqual([childA, childB, childC])
    expect(mocks.resolveOutputAssetItems).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1' }),
      { createdAt: parent.created_at, signal: expect.any(AbortSignal) }
    )
  })

  it('mixes single and multi-output assets correctly', async () => {
    const single = createAsset({ id: 'single', name: 'single.png' })
    const parent = createMultiOutputAsset('job-2', 2)
    const childA = createAsset({ id: 'child-a' })
    const childB = createAsset({ id: 'child-b' })

    mocks.resolveOutputAssetItems.mockResolvedValue([childA, childB])

    const assets = ref([single, parent])
    const groupByJob = ref(false)

    const { ungroupedAssets } = useUngroupedAssets(assets, groupByJob)
    await flushPromises()

    expect(ungroupedAssets.value).toEqual([single, childA, childB])
  })

  it('falls back to original asset when resolution returns null', async () => {
    const parent = createMultiOutputAsset('job-1', 3)
    mocks.resolveOutputAssetItems.mockResolvedValue(null)

    const assets = ref([parent])
    const groupByJob = ref(false)

    const { ungroupedAssets } = useUngroupedAssets(assets, groupByJob)
    await flushPromises()

    expect(ungroupedAssets.value).toEqual([parent])
  })

  it('falls back to original asset when resolution returns empty array', async () => {
    const parent = createMultiOutputAsset('job-empty', 3)
    mocks.resolveOutputAssetItems.mockResolvedValue([])

    const assets = ref([parent])
    const groupByJob = ref(false)

    const { ungroupedAssets } = useUngroupedAssets(assets, groupByJob)
    await flushPromises()

    expect(ungroupedAssets.value).toEqual([parent])
  })

  it('triggers resolution when groupByJob toggles from true to false', async () => {
    const parent = createMultiOutputAsset('job-1', 2)
    const childA = createAsset({ id: 'child-a' })
    const childB = createAsset({ id: 'child-b' })
    mocks.resolveOutputAssetItems.mockResolvedValue([childA, childB])

    const assets = ref([parent])
    const groupByJob = ref(true)

    const { ungroupedAssets } = useUngroupedAssets(assets, groupByJob)
    await flushPromises()

    expect(ungroupedAssets.value).toEqual([parent])
    expect(mocks.resolveOutputAssetItems).not.toHaveBeenCalled()

    groupByJob.value = false
    await nextTick()
    await flushPromises()

    expect(mocks.resolveOutputAssetItems).toHaveBeenCalledTimes(1)
    expect(ungroupedAssets.value).toEqual([childA, childB])
  })

  it('does not re-resolve cached jobIds on repeated toggles', async () => {
    const parent = createMultiOutputAsset('job-1', 2)
    const children = [
      createAsset({ id: 'child-a' }),
      createAsset({ id: 'child-b' })
    ]
    mocks.resolveOutputAssetItems.mockResolvedValue(children)

    const assets = ref([parent])
    const groupByJob = ref(false)

    const { ungroupedAssets } = useUngroupedAssets(assets, groupByJob)
    await flushPromises()

    expect(mocks.resolveOutputAssetItems).toHaveBeenCalledTimes(1)
    expect(ungroupedAssets.value).toEqual(children)

    // Toggle back and forth
    groupByJob.value = true
    await nextTick()
    await flushPromises()

    groupByJob.value = false
    await nextTick()
    await flushPromises()

    // useCachedRequest should return cached result
    expect(mocks.resolveOutputAssetItems).toHaveBeenCalledTimes(1)
    expect(ungroupedAssets.value).toEqual(children)
  })

  it('falls back to original asset when resolution rejects', async () => {
    const parent = createMultiOutputAsset('job-err', 3)
    mocks.resolveOutputAssetItems.mockRejectedValue(new Error('network error'))

    const assets = ref([parent])
    const groupByJob = ref(false)

    const { ungroupedAssets } = useUngroupedAssets(assets, groupByJob)
    await flushPromises()

    // useCachedRequest converts errors to null, fallback to [asset]
    expect(ungroupedAssets.value).toEqual([parent])
  })
})
