import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'

test(
  'Legacy custom nodes can remove links through slot mirrors',
  { tag: ['@canvas', '@node'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

    await test.step('Disconnect an input by assigning null', async () => {
      const disconnected = await legacyApi.disconnectInputByAssigningNull(
        'KSampler',
        0
      )

      expect(disconnected).toBe(true)
    })

    await test.step('Disconnect one output link with splice', async () => {
      const topology = await legacyApi.spliceOutputLinks(
        'CheckpointLoaderSimple',
        1
      )

      expect(topology).toEqual({
        removed: true,
        retained: true,
        viewSynchronized: true
      })
    })

    await test.step('Disconnect all output links by assigning an empty array', async () => {
      const disconnected = await legacyApi.replaceOutputLinksWithEmptyArray(
        'CheckpointLoaderSimple',
        2
      )

      expect(disconnected).toBe(true)
    })
  }
)
