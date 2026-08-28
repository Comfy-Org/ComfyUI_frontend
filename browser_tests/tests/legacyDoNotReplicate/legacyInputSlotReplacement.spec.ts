import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'

test.describe(
  'Legacy input slot replacement',
  { tag: ['@canvas', '@node'] },
  () => {
    test('PromptChain-style copies retain connected autogrow inputs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

      const result =
        await legacyApi.replaceAndTrimInputsLikePromptChain('KSampler')

      expect(result).toEqual({ inputCount: 5, preservedLinks: 4 })
    })

    test('GJJ Video Combine-style mapped copies retain live links', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

      const result =
        await legacyApi.replaceInputsWithMappedCopiesLikeGjjVideoCombine(
          'KSampler'
        )

      expect(result).toEqual({ inputCountPreserved: true, preservedLinks: 4 })
    })
  }
)
