import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { AssetsHelper } from '@e2e/fixtures/helpers/AssetsHelper'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

export const assetsFixture = comfyPageFixture.extend<{
  initialAssetHistory: RawJobListItem[] | undefined
  initialAssetInputFiles: string[] | undefined
  assetMocks: AssetsHelper
}>({
  initialAssetHistory: [undefined, { option: true }],
  initialAssetInputFiles: [undefined, { option: true }],
  assetMocks: [
    async ({ page, initialAssetHistory, initialAssetInputFiles }, use) => {
      const mocks = new AssetsHelper(page)
      try {
        if (initialAssetHistory)
          await mocks.mockOutputHistory(initialAssetHistory)
        if (initialAssetInputFiles)
          await mocks.mockInputFiles(initialAssetInputFiles)
        await use(mocks)
      } finally {
        await mocks.clearMocks()
      }
    },
    { auto: true }
  ]
})
