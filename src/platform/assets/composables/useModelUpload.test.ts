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
  () => ({
    default: {}
  })
)
vi.mock<unknown>(
  import('@/platform/assets/components/UploadModelDialogHeader.vue'),
  () => ({
    default: {}
  })
)
vi.mock<unknown>(
  import('@/platform/assets/components/UploadModelUpgradeModal.vue'),
  () => ({
    default: {}
  })
)
vi.mock<unknown>(
  import('@/platform/assets/components/UploadModelUpgradeModalHeader.vue'),
  () => ({ default: {} })
)

import { useDialogStore } from '@/stores/dialogStore'

import { useModelUpload } from './useModelUpload'

describe('useModelUpload dialog sizing', () => {
  beforeEach(() => {
    flags.privateModelsEnabled = false
  })

  it.for([false, true])(
    'shrink-wraps upload content without exceeding the viewport (privateModels: %s)',
    (privateModelsEnabled) => {
      flags.privateModelsEnabled = privateModelsEnabled
      const showDialog = vi.mocked(useDialogStore().showDialog)

      useModelUpload().showUploadDialog()

      expect(showDialog.mock.calls[0][0].dialogComponentProps).toMatchObject({
        contentClass: 'w-fit max-w-[calc(100vw-1rem)]',
        size: 'lg'
      })
    }
  )
})
