import { ModelLibraryHelper } from '@e2e/fixtures/helpers/ModelLibraryHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export const modelLibraryFixture = base.extend<{
  modelFolders: Parameters<ModelLibraryHelper['mockFoldersWithFiles']>[0]
  modelLibrary: ModelLibraryHelper
}>({
  modelFolders: [{}, { option: true }],
  modelLibrary: [
    async ({ page, modelFolders }, use) => {
      const modelLibrary = new ModelLibraryHelper(page)
      await modelLibrary.mockFoldersWithFiles(modelFolders)
      await use(modelLibrary)
    },
    { auto: true }
  ]
})
