import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'
import { toNodeId } from '@/types/nodeId'

test(
  'Can display a slot mismatched from widget type',
  { tag: '@vue-nodes' },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)
    await legacyApi.assignInputType(toNodeId(5), 0, 'INT,FLOAT')
    const width = comfyPage.vueNodes
      .getNodeByTitle('Empty Latent')
      .locator('.lg-node-widget')
      .first()
    await expect(width.locator('path[fill*="INT"]')).toBeVisible()
    await expect(width.locator('path[fill*="FLOAT"]')).toBeVisible()
  }
)
