import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'

test(
  'Legacy custom nodes can spread-copy a link and read its topology fields',
  { tag: ['@canvas', '@node'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

    const copy = await legacyApi.spreadCopyLinkTopology(
      'CheckpointLoaderSimple',
      0
    )

    expect(copy.ownKeys).toEqual(
      expect.arrayContaining([
        'id',
        'origin_id',
        'origin_slot',
        'parentId',
        'target_id',
        'target_slot',
        'type'
      ])
    )
    expect(copy.id).not.toBeUndefined()
    expect(copy.origin_id).not.toBeUndefined()
    expect(copy.target_id).not.toBeUndefined()
  }
)
