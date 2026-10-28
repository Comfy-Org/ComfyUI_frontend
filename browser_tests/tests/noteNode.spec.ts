import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expectRegionScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

test.describe('Note Node', { tag: '@node' }, () => {
  test('Can load node nodes', { tag: '@screenshot' }, async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')
    await expectRegionScreenshot(
      comfyPage.page,
      await comfyPage.nodeOps.getAllNodeRefs(),
      'note_nodes.png'
    )
  })
})
