import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { attachPreview } from '@/platform/assets/utils/attachPreview'
import type { PagedList } from '@/utils/pagedList'

import { generatePreviewsForNewAssets } from './hdrPreviewGeneration'

vi.mock(import('@/platform/assets/services/assetService'), () =>
  fromPartial({ assetService: { getAssetDetails: vi.fn() } })
)
vi.mock(import('@/platform/assets/utils/attachPreview'))
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
vi.mock(import('@/composables/useFeatureFlags'), () =>
  fromPartial({ useFeatureFlags: () => ({ flags: { assetsEnabled: true } }) })
)

const thumbnail = new Blob(['jpeg'], { type: 'image/jpeg' })

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror = null
  postMessage() {
    queueMicrotask(() => this.onmessage?.({ data: thumbnail }))
  }
  terminate() {}
}

function exrAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return fromPartial({
    id: 'exr-id',
    name: 'sky.exr',
    tags: ['input'],
    created_at: new Date().toISOString(),
    ...overrides
  })
}

function watchNewAssets() {
  const items = ref<AssetItem[]>([])
  const invalidate = vi.fn().mockResolvedValue(undefined)
  const list = fromPartial<PagedList<AssetItem>>({
    items,
    hasMore: ref(false),
    invalidate
  })
  generatePreviewsForNewAssets(list)
  return { items, invalidate }
}

async function addAndSettle(asset: AssetItem) {
  const { items, invalidate } = watchNewAssets()
  items.value = [asset]
  await vi.waitFor(() => expect(invalidate).toHaveBeenCalled())
}

describe('generatePreviewsForNewAssets', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker)
  })

  it('attaches a rendered preview to a new HDR asset that still lacks one', async () => {
    vi.mocked(assetService.getAssetDetails).mockResolvedValue(exrAsset())

    await addAndSettle(exrAsset())

    expect(attachPreview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'exr-id' }),
      thumbnail
    )
  })

  it('does not attach when another client attached a preview meanwhile', async () => {
    vi.mocked(assetService.getAssetDetails).mockResolvedValue(
      exrAsset({ preview_id: 'other-preview', preview_url: '/p.jpg' })
    )

    await addAndSettle(exrAsset())

    expect(attachPreview).not.toHaveBeenCalled()
  })

  it('leaves the asset to the tab already generating its preview', async () => {
    const request = vi.fn(
      (_name: string, _options: object, task: (lock: null) => unknown) =>
        Promise.resolve(task(null))
    )
    vi.stubGlobal('navigator', { locks: { request } })

    await addAndSettle(exrAsset())

    expect(request).toHaveBeenCalledWith(
      'hdr-preview:exr-id',
      { ifAvailable: true },
      expect.any(Function)
    )
    expect(assetService.getAssetDetails).not.toHaveBeenCalled()
    expect(attachPreview).not.toHaveBeenCalled()
  })
})
