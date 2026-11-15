import { describe, expect, it, vi } from 'vitest'

import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/i18n'))

describe('useAssetBrowserDialog without a registered modal', () => {
  it('reports the failure and opens no dialog when browse() is called', async () => {
    await useAssetBrowserDialog().browse({ assetType: 'models' })

    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_opening_asset_browser_modal'
      })
    )
    expect(useDialogStore().showDialog).not.toHaveBeenCalled()
  })
})
