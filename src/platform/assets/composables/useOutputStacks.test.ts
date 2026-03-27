import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useOutputStacks } from '@/platform/assets/composables/useOutputStacks'

const mocks = vi.hoisted(() => ({
  resolveAssetOutputs: vi.fn()
}))

vi.mock('@/platform/assets/composables/resolveAssetOutputs', () => ({
  resolveAssetOutputs: mocks.resolveAssetOutputs
}))

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn
    reject = rejectFn
  })
  return { promise, resolve, reject }
}

function createAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    name: 'parent.png',
    tags: [],
    created_at: '2025-01-01T00:00:00.000Z',
    user_metadata: {
      jobId: 'job-1',
      nodeId: 'node-1',
      subfolder: 'outputs'
    },
    ...overrides
  }
}

describe('useOutputStacks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('expands stacks and exposes children as selectable assets', async () => {
    const parent = createAsset({ id: 'parent', name: 'parent.png' })
    const childA = createAsset({
      id: 'child-a',
      name: 'child-a.png',
      user_metadata: undefined
    })
    const childB = createAsset({
      id: 'child-b',
      name: 'child-b.png',
      user_metadata: undefined
    })

    mocks.resolveAssetOutputs.mockResolvedValue([childA, childB])

    const { assetItems, isStackExpanded, selectableAssets, toggleStack } =
      useOutputStacks({ assets: ref([parent]) })

    await toggleStack(parent)

    expect(mocks.resolveAssetOutputs).toHaveBeenCalledWith(
      parent,
      expect.objectContaining({
        createdAt: parent.created_at,
        excludeOutputKey: 'node-1-outputs-parent.png',
        excludeParent: true
      })
    )
    expect(isStackExpanded(parent)).toBe(true)
    expect(assetItems.value.map((item) => item.asset.id)).toEqual([
      parent.id,
      childA.id,
      childB.id
    ])
    expect(assetItems.value[1]).toMatchObject({
      asset: childA,
      isChild: true
    })
    expect(assetItems.value[2]).toMatchObject({
      asset: childB,
      isChild: true
    })
    expect(selectableAssets.value).toEqual([parent, childA, childB])
  })

  it('collapses an expanded stack when toggled again', async () => {
    const parent = createAsset({ id: 'parent', name: 'parent.png' })
    const child = createAsset({
      id: 'child',
      name: 'child.png',
      user_metadata: undefined
    })

    mocks.resolveAssetOutputs.mockResolvedValue([child])

    const { assetItems, isStackExpanded, toggleStack } = useOutputStacks({
      assets: ref([parent])
    })

    await toggleStack(parent)
    await toggleStack(parent)

    expect(isStackExpanded(parent)).toBe(false)
    expect(assetItems.value.map((item) => item.asset.id)).toEqual([parent.id])
  })

  it('ignores assets without stack metadata', async () => {
    const asset = createAsset({
      id: 'no-meta',
      name: 'no-meta.png',
      user_metadata: undefined
    })

    const { assetItems, isStackExpanded, toggleStack } = useOutputStacks({
      assets: ref([asset])
    })

    await toggleStack(asset)

    expect(mocks.resolveAssetOutputs).not.toHaveBeenCalled()
    expect(isStackExpanded(asset)).toBe(false)
    expect(assetItems.value).toHaveLength(1)
    expect(assetItems.value[0].asset).toMatchObject(asset)
  })

  it('does not expand when no children are resolved', async () => {
    const parent = createAsset({ id: 'parent', name: 'parent.png' })

    mocks.resolveAssetOutputs.mockResolvedValue([])

    const { assetItems, isStackExpanded, toggleStack } = useOutputStacks({
      assets: ref([parent])
    })

    await toggleStack(parent)

    expect(isStackExpanded(parent)).toBe(false)
    expect(assetItems.value.map((item) => item.asset.id)).toEqual([parent.id])
  })

  it('does not expand when resolving children throws', async () => {
    const parent = createAsset({ id: 'parent', name: 'parent.png' })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.resolveAssetOutputs.mockRejectedValue(new Error('resolve failed'))

    const { assetItems, isStackExpanded, toggleStack } = useOutputStacks({
      assets: ref([parent])
    })

    await toggleStack(parent)

    expect(isStackExpanded(parent)).toBe(false)
    expect(assetItems.value.map((item) => item.asset.id)).toEqual([parent.id])

    errorSpy.mockRestore()
  })

  it('guards against duplicate loads while a stack is resolving', async () => {
    const parent = createAsset({ id: 'parent', name: 'parent.png' })
    const child = createAsset({
      id: 'child',
      name: 'child.png',
      user_metadata: undefined
    })
    const deferred = createDeferred<AssetItem[]>()

    mocks.resolveAssetOutputs.mockReturnValue(deferred.promise)

    const { assetItems, toggleStack } = useOutputStacks({
      assets: ref([parent])
    })

    const firstToggle = toggleStack(parent)
    const secondToggle = toggleStack(parent)

    expect(mocks.resolveAssetOutputs).toHaveBeenCalledTimes(1)

    deferred.resolve([child])

    await firstToggle
    await secondToggle

    expect(assetItems.value.map((item) => item.asset.id)).toEqual([
      parent.id,
      child.id
    ])
  })

  describe('cloud path (prompt_id)', () => {
    it('passes excludeParent for cloud assets with prompt_id', async () => {
      const parent = createAsset({
        id: 'parent',
        name: 'parent.png',
        prompt_id: 'prompt-1',
        user_metadata: undefined
      })
      const childA = createAsset({ id: 'child-a', name: 'a.png' })
      const childB = createAsset({ id: 'child-b', name: 'b.png' })

      mocks.resolveAssetOutputs.mockResolvedValue([childA, childB])

      const { assetItems, isStackExpanded, toggleStack } = useOutputStacks({
        assets: ref([parent])
      })

      await toggleStack(parent)

      expect(mocks.resolveAssetOutputs).toHaveBeenCalledWith(
        parent,
        expect.objectContaining({ excludeParent: true })
      )
      expect(isStackExpanded(parent)).toBe(true)
      expect(assetItems.value.map((i) => i.asset.id)).toEqual([
        'parent',
        'child-a',
        'child-b'
      ])
    })

    it('uses prompt_id as stack key over metadata.jobId', async () => {
      const assetA = createAsset({
        id: 'a',
        prompt_id: 'shared-prompt',
        user_metadata: { jobId: 'job-1', nodeId: '1', subfolder: '' }
      })
      const assetB = createAsset({
        id: 'b',
        prompt_id: 'different-prompt',
        user_metadata: { jobId: 'job-1', nodeId: '1', subfolder: '' }
      })
      const child = createAsset({ id: 'child', name: 'child.png' })

      mocks.resolveAssetOutputs.mockResolvedValue([child])

      const { isStackExpanded, toggleStack } = useOutputStacks({
        assets: ref([assetA, assetB])
      })

      await toggleStack(assetA)

      expect(isStackExpanded(assetA)).toBe(true)
      expect(isStackExpanded(assetB)).toBe(false)
    })

    it('ignores asset without prompt_id or metadata', async () => {
      const asset = createAsset({
        id: 'no-key',
        prompt_id: null,
        user_metadata: undefined
      })

      const { toggleStack } = useOutputStacks({
        assets: ref([asset])
      })

      await toggleStack(asset)

      expect(mocks.resolveAssetOutputs).not.toHaveBeenCalled()
    })
  })
})
