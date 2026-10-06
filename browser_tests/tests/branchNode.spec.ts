import { z } from 'zod'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDefaultFixture } from '@e2e/fixtures/components/WidgetSelectDefault'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { zComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

const zPromptRequestBody = z.object({ prompt: zComfyApiWorkflow })

test('Branch Node', { tag: '@vue-nodes' }, async ({ comfyPage }) => {
  await comfyPage.nodeOps.clearGraph()
  await comfyPage.searchBoxV2.addNode('Test Branch Node', {
    position: { x: 700, y: 200 }
  })
  const branchNode =
    await comfyPage.vueNodes.getFixtureByTitle('Test Branch Node')

  const choiceWidget = new WidgetSelectDefaultFixture(branchNode.root)
  const { options } = choiceWidget

  await choiceWidget.open()
  await expect(options, 'nothing connected').toBeHidden()
  await choiceWidget.close()

  await test.step('Connect inputs', async () => {
    await comfyPage.searchBoxV2.addNode('Load Checkpoint')
    const loadNode = await comfyPage.vueNodes.getFixtureByTitle('Load Check')
    const loadSlot = loadNode.getSlot('MODEL')
    await expect(loadSlot).toBeVisible()
    for (let i = 0; i < 3; i++)
      await loadSlot.dragTo(branchNode.getSlot(`branch${i}`))

    await choiceWidget.open()
    await expect(options, '3 branches added').toHaveCount(3)
    await choiceWidget.close()
  })

  const userLabel = 'H3'

  await test.step('Rename input', async () => {
    await branchNode.root.getByText('branch0').dblclick()
    await branchNode.root.locator('.editable-text input').fill(userLabel)
    await branchNode.root.locator('.editable-text input').press('Enter')

    await choiceWidget.open()
    await expect(options.getByText(userLabel)).toBeVisible()
    await choiceWidget.close()
  })

  await test.step('Prompt serialization', async () => {
    await choiceWidget.selectOption(userLabel)

    let requestBody: unknown
    await new ExecutionHelper(comfyPage).run({
      onPromptRequest: (body) => {
        requestBody = body
      }
    })
    const { prompt } = zPromptRequestBody.parse(requestBody)
    expect(Object.values(prompt)).toContainEqual(
      expect.objectContaining({
        class_type: 'DevToolsBranchNode',
        inputs: expect.objectContaining({
          branch: userLabel,
          branch_names: { __value__: [userLabel, 'branch1', 'branch2'] }
        })
      })
    )
  })

  await test.step('Remove selected input', async () => {
    await choiceWidget.open()
    await expect(options.getByText('branch2')).toBeVisible()
    await choiceWidget.close()

    await branchNode.getSlot(`branch2`).click({ modifiers: ['Alt', 'Control'] })
    await choiceWidget.open()
    await expect(options.getByText('branch2')).toBeHidden()
    await choiceWidget.close()
  })

  await test.step('Connect primitive', async () => {
    await comfyPage.searchBoxV2.addNode('Primitive', {
      position: { x: 200, y: 500 }
    })
    const primitiveNode =
      await comfyPage.vueNodes.getFixtureByTitle('Primitive')
    const slotLocator = comfyPage.page.getByRole('combobox', { name: 'branch' })
    await primitiveNode
      .getSlot('connect to widget input')
      .dragTo(branchNode.getSlot(slotLocator))
    const primitiveWidget = new WidgetSelectDefaultFixture(primitiveNode.root)
    await primitiveWidget.open()
    await expect(primitiveWidget.options).toHaveText([userLabel, 'branch1'])
    await primitiveWidget.close()
  })
})
