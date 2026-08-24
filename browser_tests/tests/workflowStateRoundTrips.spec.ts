import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

test.describe(
  'Workflow state round trips',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('undo and redo a connected node deletion', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')

      const sampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const cfgInput = comfyPage.vueNodes.getInputNumberControls(
        comfyPage.vueNodes.getWidgetByName('KSampler', 'cfg')
      ).input
      const originalBounds = await sampler.boundingBox()
      if (!originalBounds) throw new Error('KSampler is not rendered')
      const originalCfg = Number(await cfgInput.inputValue())

      await sampler.delete()
      await expect(sampler.root).toBeHidden()

      await comfyPage.keyboard.undo()
      await expect(sampler.root).toBeVisible()
      await expect(sampler.root).toHaveBounds(originalBounds)
      await expect
        .poll(async () => Number(await cfgInput.inputValue()))
        .toBe(originalCfg)

      await comfyPage.keyboard.redo()
      await expect(sampler.root).toBeHidden()
      await comfyPage.keyboard.undo()
      await expect(sampler.root).toBeVisible()

      let requestBody: unknown
      await new ExecutionHelper(comfyPage).run({
        onPromptRequest: (body) => {
          requestBody = body
        }
      })
      expect(requestBody).toMatchObject({
        prompt: {
          '3': {
            class_type: 'KSampler',
            inputs: {
              cfg: originalCfg,
              model: ['4', 0],
              positive: ['6', 0],
              negative: ['7', 0],
              latent_image: ['5', 0]
            }
          }
        }
      })
    })

    test('the original subgraph remains usable after deleting its copy', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const original = comfyPage.vueNodes.getNodeLocator('2')
      await comfyPage.vueNodes.selectNode('2')
      await comfyPage.page.mouse.move(10, 10)
      await comfyPage.nextFrame()
      await comfyPage.clipboard.copy()
      await comfyPage.clipboard.paste()

      await expect(
        comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      ).toHaveCount(2)
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
      const copy = comfyPage.vueNodes.selectedNodes
      await expect(copy).not.toHaveAttribute('data-node-id', '2')

      await comfyPage.vueNodes.deleteSelected()
      await expect(copy).toBeHidden()
      await expect(original).toBeVisible()

      await comfyPage.vueNodes.enterSubgraph('2')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(2)
    })
  }
)
