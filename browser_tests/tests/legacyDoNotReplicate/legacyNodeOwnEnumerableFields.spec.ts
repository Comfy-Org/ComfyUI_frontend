import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'

test(
  'Legacy translation-pack hooks can gate on node.hasOwnProperty and Object.keys(node)',
  { tag: ['@canvas', '@node'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

    const result = await legacyApi.getOwnEnumerableShellKeys(
      'CheckpointLoaderSimple'
    )

    expect(result.hasOwnInputs).toBe(true)
    expect(result.hasOwnOutputs).toBe(true)
    expect(result.hasOwnWidgets).toBe(true)
    expect(result.hasOwnProperties).toBe(true)
    expect(result.hasOwnBoxcolor).toBe(true)
    expect(result.ownKeys).toEqual(
      expect.arrayContaining(['inputs', 'outputs', 'properties', 'boxcolor'])
    )
  }
)
