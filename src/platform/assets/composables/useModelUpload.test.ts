import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const flags = vi.hoisted(() => ({
  privateModelsEnabled: false,
  modelUploadButtonEnabled: true
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
}))
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags })
}))
vi.mock('@/platform/assets/components/UploadModelDialog.vue', () => ({
  default: {}
}))
vi.mock('@/platform/assets/components/UploadModelDialogHeader.vue', () => ({
  default: {}
}))
vi.mock('@/platform/assets/components/UploadModelUpgradeModal.vue', () => ({
  default: {}
}))
vi.mock(
  '@/platform/assets/components/UploadModelUpgradeModalHeader.vue',
  () => ({ default: {} })
)

import { HUG_CONTENT_CLASS } from '@/components/ui/dialog/dialog.variants'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'

describe('useModelUpload', () => {
  beforeEach(() => {
    showDialog.mockClear()
    flags.privateModelsEnabled = false
  })

  it.for([false, true])(
    'shrink-wraps the dialog with the shared hug token (privateModels: %s)',
    (privateModelsEnabled) => {
      flags.privateModelsEnabled = privateModelsEnabled

      useModelUpload().showUploadDialog()

      const [args] = showDialog.mock.calls[0]
      expect(args.dialogComponentProps.contentClass).toBe(HUG_CONTENT_CLASS)
    }
  )
})
