import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

test.describe('Workflow state round trips', { tag: ['@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('undo and redo a connected node deletion', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')

    const sampler = await comfyPage.nodeOps.getNodeRefById('3')
    const originalPosition = await sampler.getProperty<[number, number]>('pos')
    const originalCfg = await (await sampler.getWidgetByName('cfg')).getValue()

    await sampler.click('title')
    await comfyPage.keyboard.delete()
    await expect.poll(() => sampler.exists()).toBe(false)

    await comfyPage.keyboard.undo()
    await expect.poll(() => sampler.exists()).toBe(true)
    expect(await sampler.getProperty<[number, number]>('pos')).toEqual(
      originalPosition
    )
    expect(await (await sampler.getWidgetByName('cfg')).getValue()).toBe(
      originalCfg
    )

    await comfyPage.keyboard.redo()
    await expect.poll(() => sampler.exists()).toBe(false)
    await comfyPage.keyboard.undo()
    await expect.poll(() => sampler.exists()).toBe(true)

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

    const original = await comfyPage.nodeOps.getNodeRefById('2')
    await original.click('title')
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()

    await expect
      .poll(
        async () =>
          (await comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph')).length
      )
      .toBe(2)
    const instances = await comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph')
    const copy = instances.find((node) => node.id !== original.id)
    if (!copy) throw new Error('Pasted subgraph was not found')
    expect(await copy.getType()).not.toBe(await original.getType())

    await comfyPage.keyboard.delete()
    await expect.poll(() => copy.exists()).toBe(false)
    await expect.poll(() => original.exists()).toBe(true)

    await original.navigateIntoSubgraph()
    await expect.poll(() => comfyPage.subgraph.getNodeCount()).toBe(2)
  })
})
