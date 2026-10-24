import { ModelLibraryHelper } from '@e2e/fixtures/helpers/ModelLibraryHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export const modelLibraryFixture = base.extend<{
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
