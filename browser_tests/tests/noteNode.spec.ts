import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
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

for (const { renderer, tag } of [
  { renderer: 'classic', tag: '@node' },
  { renderer: 'Vue', tag: '@vue-nodes' }
]) {
  test.describe(`Markdown formatting in ${renderer} nodes`, { tag }, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/markdown_baseline')
    })

    test('preserves heading weight and list markers', async ({ comfyPage }) => {
      await expect(
        comfyPage.page.getByRole('heading', {
          name: 'Formatting survives the reset',
          level: 4
        })
      ).toHaveCSS('font-weight', '700')
      await expect(
        comfyPage.page.getByRole('list').filter({ hasText: 'Bullet item' })
      ).toHaveCSS('list-style-type', 'disc')
      await expect(
        comfyPage.page.getByRole('list').filter({ hasText: 'Numbered item' })
      ).toHaveCSS('list-style-type', 'decimal')
    })
  })
}
