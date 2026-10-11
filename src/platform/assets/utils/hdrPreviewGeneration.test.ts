import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, ref } from 'vue'

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

let workersStarted = 0

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror = null
  constructor() {
    workersStarted++
  }
  postMessage() {
    queueMicrotask(() => this.onmessage?.({ data: thumbnail }))
  }
  terminate() {}
}

/** Web Locks that grant one holder at a time, as a secure-context browser does. */
function stubGrantingLocks() {
  let held: Promise<unknown> = Promise.resolve()
  const request = vi.fn((_name: string, task: (lock: object) => unknown) => {
    const run = held.then(() => task({}))
    held = run.catch(() => undefined)
    return run
  })
  vi.stubGlobal('navigator', { locks: { request } })
  return request
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
  const scope = effectScope()
  scope.run(() => generatePreviewsForNewAssets(list))
  onTestFinished(() => scope.stop())
  return { items, invalidate }
}

async function addAndSettle(asset: AssetItem) {
  const { items, invalidate } = watchNewAssets()
  items.value = [asset]
  await vi.waitFor(() => expect(invalidate).toHaveBeenCalled())
}

describe('generatePreviewsForNewAssets', () => {
  beforeEach(() => {
    workersStarted = 0
    vi.stubGlobal('Worker', FakeWorker)
  })

  it.for([
    { locks: 'granted', stub: stubGrantingLocks },
    { locks: 'unavailable', stub: () => vi.stubGlobal('navigator', {}) }
  ])(
    'attaches a rendered preview to a new HDR asset when locks are $locks',
    async ({ stub }) => {
      stub()
      vi.mocked(assetService.getAssetDetails).mockResolvedValue(exrAsset())

      await addAndSettle(exrAsset())

      expect(attachPreview).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'exr-id' }),
        thumbnail
      )
    }
  )

  it('does not attach when another client attached a preview while rendering', async () => {
    stubGrantingLocks()
    vi.mocked(assetService.getAssetDetails)
      .mockResolvedValueOnce(exrAsset())
      .mockResolvedValue(
        exrAsset({ preview_id: 'other-preview', preview_url: '/p.jpg' })
      )

    await addAndSettle(exrAsset())

    expect(workersStarted).toBe(1)
    expect(attachPreview).not.toHaveBeenCalled()
  })

  it('still generates a preview when the asset lookup fails', async () => {
    stubGrantingLocks()
    vi.mocked(assetService.getAssetDetails).mockRejectedValue(
      new Error('asset lookup failed')
    )

    await addAndSettle(exrAsset())

    expect(workersStarted).toBe(1)
    expect(attachPreview).toHaveBeenCalledOnce()
  })

  it('lets one tab render while another waits and then reuses its preview', async () => {
    const request = stubGrantingLocks()
    let attached = false
    vi.mocked(attachPreview).mockImplementation(async () => {
      attached = true
    })
    vi.mocked(assetService.getAssetDetails).mockImplementation(async () =>
      attached
        ? exrAsset({ preview_id: 'tab-preview', preview_url: '/p.jpg' })
        : exrAsset()
    )
    const firstTab = watchNewAssets()
    const secondTab = watchNewAssets()

    firstTab.items.value = [exrAsset()]
    secondTab.items.value = [exrAsset()]
    await vi.waitFor(() => {
      expect(firstTab.invalidate).toHaveBeenCalled()
      expect(secondTab.invalidate).toHaveBeenCalled()
    })

    expect(request).toHaveBeenCalledWith(
      'hdr-preview:exr-id',
      expect.any(Function)
    )
    expect(workersStarted).toBe(1)
    expect(attachPreview).toHaveBeenCalledOnce()
  })
})
