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

import * as dialogVariants from '@/components/ui/dialog/dialog.variants'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'

const { HUG_CONTENT_CLASS } = dialogVariants as typeof dialogVariants & {
  HUG_CONTENT_CLASS: string
}

describe('useModelUpload', () => {
  beforeEach(() => {
    showDialog.mockClear()
    flags.privateModelsEnabled = false
  })

  it.fails('shrink-wraps the upgrade dialog with the shared hug token', () => {
    // W10 baseline expected failure: this exhaustive-QA slice assertion fails
    // on main@f954e479 because the dialog uses an inline width cap instead.
    flags.privateModelsEnabled = false

    useModelUpload().showUploadDialog()

    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.contentClass).toBe(HUG_CONTENT_CLASS)
  })

  it.fails('shrink-wraps the upload dialog with the shared hug token', () => {
    // W10 baseline expected failure: this exhaustive-QA slice assertion fails
    // on main@f954e479 because the dialog uses an inline width cap instead.
    flags.privateModelsEnabled = true

    useModelUpload().showUploadDialog()

    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.contentClass).toBe(HUG_CONTENT_CLASS)
  })
})
