import { beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({
  privateModelsEnabled: false,
  modelUploadButtonEnabled: true
}))

vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({ flags })
}))
vi.mock<unknown>(
  import('@/platform/assets/components/UploadModelDialog.vue'),
  () => ({ default: {} })
)
vi.mock<unknown>(
  import('@/platform/assets/components/UploadModelDialogHeader.vue'),
  () => ({ default: {} })
)
vi.mock<unknown>(
  import('@/platform/assets/components/UploadModelUpgradeModal.vue'),
  () => ({ default: {} })
)
vi.mock<unknown>(
  import('@/platform/assets/components/UploadModelUpgradeModalHeader.vue'),
  () => ({ default: {} })
)

import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import { useDialogStore } from '@/stores/dialogStore'

describe('useModelUpload', () => {
  let showDialog: ReturnType<
    typeof vi.mocked<ReturnType<typeof useDialogStore>['showDialog']>
  >

  beforeEach(() => {
    showDialog = vi.mocked(useDialogStore().showDialog)
    showDialog.mockClear()
    flags.privateModelsEnabled = false
  })

  it.for([false, true])(
    'opens the appropriate upload dialog (privateModels: %s)',
    (privateModelsEnabled) => {
      flags.privateModelsEnabled = privateModelsEnabled

      useModelUpload().showUploadDialog()

      const [args] = showDialog.mock.calls[0]
      expect(args.key).toBe(
        privateModelsEnabled ? 'upload-model' : 'upload-model-upgrade'
      )
      expect(args.dialogComponentProps?.renderer).toBe('reka')
    }
  )
})
