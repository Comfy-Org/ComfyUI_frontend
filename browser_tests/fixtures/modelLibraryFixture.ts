import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ModelLibraryHelper } from '@e2e/fixtures/helpers/ModelLibraryHelper'

export const modelLibraryFixture = comfyPageFixture.extend<{
  initialModelFolders: Record<string, string[]>
  modelLibraryMocks: ModelLibraryHelper
}>({
  initialModelFolders: [{}, { option: true }],
  modelLibraryMocks: [
    async ({ page, initialModelFolders }, use) => {
      const mocks = new ModelLibraryHelper(page)
      try {
        await mocks.mockFoldersWithFiles(initialModelFolders)
        await use(mocks)
      } finally {
        await mocks.clearMocks()
      }
    },
    { auto: true }
  ]
})
