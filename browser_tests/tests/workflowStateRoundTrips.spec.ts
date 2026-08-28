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
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('undo and redo a connected node deletion', async ({ comfyPage }) => {
      const { sampler, samplerId, cfgWidget, originalBounds, originalCfg } =
        await test.step('Load the connected sampler and record its state', async () => {
          await comfyPage.workflow.loadWorkflow('default')

          const [samplerRef] =
            await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
          if (!samplerRef) throw new Error('KSampler was not found')
          const sampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
          const cfgWidget = await samplerRef.getWidgetByName('cfg')
          const originalBounds = await sampler.boundingBox()
          if (!originalBounds) throw new Error('KSampler is not rendered')

          return {
            sampler,
            samplerId: String(samplerRef.id),
            cfgWidget,
            originalBounds,
            originalCfg: await cfgWidget.getValue()
          }
        })

      await test.step('Delete the sampler through the Vue node', async () => {
        await sampler.delete()
        await expect(sampler.root).toBeHidden()
      })

      await test.step('Undo restores its geometry and widget value', async () => {
        await comfyPage.keyboard.undo()
        await expect(sampler.root).toBeVisible()
        await expect(sampler.root).toHaveBounds(originalBounds)
        await expect.poll(() => cfgWidget.getValue()).toBe(originalCfg)
      })

      await test.step('Redo removes it and a second undo restores it', async () => {
        await comfyPage.keyboard.redo()
        await expect(sampler.root).toBeHidden()
        await comfyPage.keyboard.undo()
        await expect(sampler.root).toBeVisible()
      })

      await test.step('Queueing uses the restored sampler connections', async () => {
        let requestBody: unknown
        await new ExecutionHelper(comfyPage).run({
          onPromptRequest: (body) => {
            requestBody = body
          }
        })
        expect(requestBody).toMatchObject({
          prompt: {
            [samplerId]: {
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
    })

    test('the original subgraph remains usable after deleting its copy', async ({
      comfyPage
    }) => {
      const { original, originalId, copy } =
        await test.step('Copy and paste the subgraph through its Vue node', async () => {
          await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

          const [originalRef] =
            await comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph')
          if (!originalRef) throw new Error('Subgraph was not found')
          const original =
            await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
          await original.select()
          await comfyPage.page.mouse.move(10, 10)
          await comfyPage.nextFrame()
          await comfyPage.clipboard.copy()
          await comfyPage.clipboard.paste()

          await expect(
            comfyPage.vueNodes.getNodeByTitle('New Subgraph')
          ).toHaveCount(2)
          await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
          const copy = comfyPage.vueNodes.selectedNodes
          await expect(copy).not.toHaveAttribute(
            'data-node-id',
            String(originalRef.id)
          )

          return {
            original: original.root,
            originalId: String(originalRef.id),
            copy
          }
        })

      await test.step('Delete the copy without removing the original', async () => {
        await comfyPage.vueNodes.deleteSelected()
        await expect(copy).toBeHidden()
        await expect(original).toBeVisible()
      })

      await test.step('Enter the surviving original subgraph', async () => {
        await comfyPage.vueNodes.enterSubgraph(originalId)
        await expect(comfyPage.vueNodes.nodes).toHaveCount(2)
      })
    })
  }
)
