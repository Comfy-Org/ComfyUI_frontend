import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@comfyorg/assets-core/schema'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { openModelLibraryBrowser } from '@/platform/assets/integration/openModelLibraryBrowser'
import { startModelNodeDragFromAsset } from '@/platform/assets/integration/startModelNodeDragFromAsset'

vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/assets/composables/useAssetBrowserDialog'))
vi.mock(import('@/platform/assets/integration/startModelNodeDragFromAsset'))

const asset = fromPartial<AssetItem>({
  id: 'asset-1',
  name: 'model.safetensors'
})

async function selectAsset() {
  const browse = vi.fn()
  vi.mocked(useAssetBrowserDialog).mockReturnValue({ browse, show: vi.fn() })
  await openModelLibraryBrowser()
  const { onAssetSelected } = browse.mock.calls[0][0]
  onAssetSelected(asset)
}

describe('openModelLibraryBrowser', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags).mockReturnValue(
      fromPartial<ReturnType<typeof useFeatureFlags>>({
        flags: { assetsEnabled: true }
      })
    )
  })

  it('explains an unmapped model category without reporting it to Sentry', async () => {
    vi.mocked(startModelNodeDragFromAsset).mockReturnValue({
      code: 'NO_PROVIDER',
      message: 'No node provider registered for category: lama',
      assetId: 'asset-1',
      details: { candidates: ['lama'] }
    })

    await selectAsset()

    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { code: 'NO_PROVIDER' },
        level: 'warning',
        sentryMode: 'never'
      })
    )
    const [toast] = useToast().toasts
    expect(toast.kind).toBe('warning')
  })

  it('still reports and shows an error for an invalid asset', async () => {
    vi.mocked(startModelNodeDragFromAsset).mockReturnValue({
      code: 'INVALID_ASSET',
      message: 'Asset has no tags defined',
      assetId: 'asset-1'
    })

    await selectAsset()

    const options = vi.mocked(reportError).mock.calls[0][1]
    expect(options).toMatchObject({ tags: { code: 'INVALID_ASSET' } })
    expect(options.sentryMode).toBeUndefined()
    const [toast] = useToast().toasts
    expect(toast.kind).toBe('error')
  })

  it('does nothing extra when the node drag starts', async () => {
    vi.mocked(startModelNodeDragFromAsset).mockReturnValue(undefined)

    await selectAsset()

    expect(reportError).not.toHaveBeenCalled()
    expect(useToast().toasts).toHaveLength(0)
  })
})
