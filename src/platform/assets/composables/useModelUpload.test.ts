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

import { useModelUpload } from './useModelUpload'

describe('useModelUpload dialog sizing', () => {
  beforeEach(() => {
    showDialog.mockClear()
    flags.privateModelsEnabled = false
  })

  it.for([false, true])(
    'shrink-wraps upload content without exceeding the viewport (privateModels: %s)',
    (privateModelsEnabled) => {
      flags.privateModelsEnabled = privateModelsEnabled

      useModelUpload().showUploadDialog()

      expect(showDialog.mock.calls[0][0].dialogComponentProps).toMatchObject({
        contentClass: 'w-fit max-w-[calc(100vw-1rem)]',
        size: 'lg'
      })
    }
  )
})
